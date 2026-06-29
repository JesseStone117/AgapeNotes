/**
 * AgapeNotes reminder orchestration.
 *
 * The encrypted vault remains the source of truth for meeting details. The
 * server only receives opaque meeting ids and due times so it can trigger a
 * generic PWA push notification without seeing person names, notes, or places.
 */

const ReminderManager = {
    _publicKey: null,
    _lastFailureMessage: '',

    isSupported() {
        return (
            typeof window !== 'undefined' &&
            typeof navigator !== 'undefined' &&
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window &&
            typeof ApiClient !== 'undefined'
        );
    },

    async getStatus() {
        if (!this.isSupported()) {
            return {
                supported: false,
                configured: false,
                permission: 'unsupported',
                subscribed: false
            };
        }

        const configured = !!(await this._getPublicKey());
        const subscription = configured ? await this._getSubscription() : null;
        return {
            supported: true,
            configured,
            permission: Notification.permission,
            subscribed: !!subscription
        };
    },

    lastFailureMessage() {
        return this._lastFailureMessage;
    },

    async ensureReadyForMeetingReminders({ showAlerts = true } = {}) {
        this._lastFailureMessage = '';

        if (!this.isSupported()) {
            return this._fail(
                'This browser does not support PWA push notifications.',
                'Reminders Unavailable',
                showAlerts
            );
        }

        const publicKey = await this._getPublicKey();
        if (!publicKey) {
            return this._fail(
                'Reminder push notifications are not configured correctly on the server yet.',
                'Reminders Unavailable',
                showAlerts
            );
        }

        if (Notification.permission === 'denied') {
            return this._fail(
                'Notifications are blocked for AgapeNotes. Enable them in your browser settings to receive meeting reminders.',
                'Notifications Blocked',
                showAlerts
            );
        }

        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                return this._fail(
                    'Notifications were not enabled.',
                    'Reminder Not Enabled',
                    showAlerts
                );
            }
        }

        const registration = await this._getReadyRegistration();
        if (!registration) {
            return this._fail(
                'Install or refresh the AgapeNotes PWA before enabling push reminders.',
                'PWA Required',
                showAlerts
            );
        }

        try {
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this._urlBase64ToUint8Array(publicKey)
                });
            }

            await ApiClient.savePushSubscription(subscription.toJSON());
            this._lastFailureMessage = '';
            return true;
        } catch (error) {
            console.warn('Could not enable meeting reminders:', error);
            return this._fail(this._friendlySetupError(error), 'Reminder Not Enabled', showAlerts);
        }
    },

    async disableForDevice() {
        if (!this.isSupported()) return false;
        const subscription = await this._getSubscription();
        if (!subscription) return true;

        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        try {
            await ApiClient.deletePushSubscription(endpoint);
        } catch (error) {
            console.warn('Could not remove push subscription on server:', error);
        }
        return true;
    },

    async syncMeeting(meeting) {
        const reminders = this._buildReminderRecords(meeting);
        if (reminders.length === 0) {
            await ApiClient.deleteMeetingReminders(meeting.id);
            return true;
        }

        const ready = await this.ensureReadyForMeetingReminders({ showAlerts: false });
        if (!ready) return false;

        await ApiClient.saveMeetingReminders(meeting.id, reminders);
        return true;
    },

    async syncMeetings(meetings) {
        const meetingsWithReminders = meetings.filter(meeting => this._buildReminderRecords(meeting).length > 0);
        if (meetingsWithReminders.length === 0) {
            await Promise.all(meetings.map(meeting => ApiClient.deleteMeetingReminders(meeting.id)));
            return true;
        }

        const ready = await this.ensureReadyForMeetingReminders({ showAlerts: false });
        if (!ready) return false;

        for (const meeting of meetings) {
            const reminders = this._buildReminderRecords(meeting);
            if (reminders.length > 0) {
                await ApiClient.saveMeetingReminders(meeting.id, reminders);
            } else {
                await ApiClient.deleteMeetingReminders(meeting.id);
            }
        }
        return true;
    },

    async deleteMeeting(meetingId) {
        try {
            await ApiClient.deleteMeetingReminders(meetingId);
        } catch (error) {
            console.warn('Could not delete meeting reminders:', error);
        }
    },

    async deleteMeetings(meetingIds) {
        for (const meetingId of meetingIds) {
            await this.deleteMeeting(meetingId);
        }
    },

    describeReminder(reminder) {
        const normalized = normalizeMeetingReminder(reminder);
        if (!normalized.enabled) return 'No reminder';
        if (normalized.mode === 'custom') {
            if (!normalized.customDateTime) return 'Custom reminder';
            return `Reminder ${this._formatDateTime(normalized.customDateTime)}`;
        }
        const offset = Number(normalized.offsetMinutes || 0);
        if (offset === 0) return 'At meeting time';
        if (offset === 1440) return '1 day before';
        if (offset % 60 === 0) return `${offset / 60} hour${offset === 60 ? '' : 's'} before`;
        return `${offset} minutes before`;
    },

    _buildReminderRecords(meeting) {
        const reminder = normalizeMeetingReminder(meeting?.reminder);
        if (!meeting?.id || !meeting.date || !meeting.time || !reminder.enabled) return [];

        const remindAt = this._calculateRemindAt(meeting, reminder);
        if (!remindAt) return [];

        return [{
            remindAt: remindAt.toISOString(),
            meetingDate: meeting.date,
            meetingTime: meeting.time,
            offsetMinutes: reminder.offsetMinutes
        }];
    },

    _calculateRemindAt(meeting, reminder) {
        if (reminder.mode === 'custom') {
            if (!reminder.customDateTime) return null;
            const custom = new Date(reminder.customDateTime);
            return Number.isNaN(custom.getTime()) ? null : custom;
        }

        const startsAt = new Date(`${meeting.date}T${meeting.time}`);
        if (Number.isNaN(startsAt.getTime())) return null;
        const offsetMinutes = Number(reminder.offsetMinutes || 0);
        return new Date(startsAt.getTime() - offsetMinutes * 60 * 1000);
    },

    async _getSubscription() {
        if (!('serviceWorker' in navigator)) return null;
        const registration = await this._getReadyRegistration();
        if (!registration) return null;
        return registration.pushManager.getSubscription();
    },

    async _getReadyRegistration() {
        return Promise.race([
            navigator.serviceWorker.ready,
            new Promise(resolve => setTimeout(() => resolve(null), 2500))
        ]);
    },

    async _getPublicKey() {
        if (this._publicKey !== null) return this._publicKey;
        try {
            const config = await ApiClient.getPushConfig();
            const publicKey = config?.publicKey || '';
            this._publicKey = this._isValidVapidPublicKey(publicKey) ? publicKey : '';
            if (publicKey && !this._publicKey) {
                console.warn('Server returned an invalid VAPID public key.');
            }
            return this._publicKey;
        } catch (error) {
            console.warn('Could not load push configuration:', error);
            this._publicKey = '';
            return '';
        }
    },

    async _fail(message, title, showAlerts) {
        this._lastFailureMessage = message;
        if (showAlerts) {
            await Dialog.alert(message, title);
        }
        return false;
    },

    _friendlySetupError(error) {
        if (error?.name === 'InvalidAccessError') {
            return 'The server push key is invalid. Update VAPID_PUBLIC_KEY with a browser PushManager public key.';
        }
        if (error?.name === 'NotAllowedError') {
            return 'Notifications are blocked or were not allowed on this device.';
        }
        if (error?.name === 'AbortError') {
            return 'This browser could not create a push subscription. Refresh the installed PWA and try again.';
        }
        return 'This device could not create or save a push subscription.';
    },

    _isValidVapidPublicKey(publicKey) {
        try {
            const bytes = this._urlBase64ToUint8Array(publicKey || '');
            return bytes.length === 65 && bytes[0] === 4;
        } catch (error) {
            return false;
        }
    },

    _urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i += 1) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },

    _formatDateTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'at the custom time';
        return date.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }
};
