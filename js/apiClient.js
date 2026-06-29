/**
 * AgapeNotes API client.
 *
 * All calls use same-origin cookies. In production the Rust server serves the app
 * and API together; in Vite dev, /api can be proxied to the Rust server.
 */

class ApiClientError extends Error {
    constructor(message, status, body = null) {
        super(message);
        this.name = 'ApiClientError';
        this.status = status;
        this.body = body;
    }
}

const ApiClient = {
    async request(path, options = {}) {
        const headers = {
            Accept: 'application/json',
            ...(options.headers || {})
        };

        let body = options.body;
        if (body && typeof body !== 'string' && !(body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(body);
        }

        const response = await fetch(path, {
            ...options,
            headers,
            body,
            credentials: 'include'
        });

        let payload = null;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            payload = await response.json();
        }

        if (!response.ok) {
            const message = payload?.error || `Request failed with ${response.status}`;
            throw new ApiClientError(message, response.status, payload);
        }

        return payload;
    },

    async getMe() {
        return this.request('/api/auth/me');
    },

    async getVault() {
        return this.request('/api/vault');
    },

    async putVault(payload) {
        return this.request('/api/vault', {
            method: 'PUT',
            body: payload
        });
    },

    async logout() {
        await this.request('/api/auth/logout', { method: 'POST' });
    },

    async getPushConfig() {
        return this.request('/api/push/config');
    },

    async savePushSubscription(subscription) {
        return this.request('/api/push/subscriptions', {
            method: 'POST',
            body: subscription
        });
    },

    async deletePushSubscription(endpoint) {
        return this.request('/api/push/subscriptions', {
            method: 'DELETE',
            body: { endpoint }
        });
    },

    async sendTestPush() {
        return this.request('/api/push/test', {
            method: 'POST'
        });
    },

    async saveMeetingReminders(meetingId, reminders) {
        return this.request('/api/reminders/meeting', {
            method: 'POST',
            body: { meetingId, reminders }
        });
    },

    async getReminderStatus() {
        return this.request('/api/reminders/status');
    },

    async deleteMeetingReminders(meetingId) {
        return this.request(`/api/reminders/meeting/${encodeURIComponent(meetingId)}`, {
            method: 'DELETE'
        });
    },

    signInWithGoogle() {
        window.location.href = '/api/auth/google/start';
    }
};
