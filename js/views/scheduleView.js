/**
 * AgapeNotes Schedule View
 *
 * Monthly calendar with meeting management,
 * person linking, and weekly-repeat support.
 */

const ScheduleView = {
    _currentMonth: new Date().getMonth(),
    _currentYear: new Date().getFullYear(),
    _meetings: [],
    _allPeople: [],

    // =========================================================
    //  Public API
    // =========================================================

    async render() {
        const main = document.getElementById('main-content');
        main.innerHTML = '';
        main.className = 'main-content animate-fade-in';

        // Clear header action
        const headerAction = document.getElementById('header-action');
        if (headerAction) headerAction.innerHTML = '';

        // Load meetings
        this._meetings = await storage.getMeetings();
        this._allPeople = this._gatherPeople();

        const container = document.createElement('div');
        container.className = 'schedule-view';
        container.id = 'schedule-view';
        main.appendChild(container);

        this._renderCalendar(container);
    },

    // =========================================================
    //  People helpers
    // =========================================================

    _gatherPeople() {
        const staff = (appState.get('staff') || []).map(p => ({ ...p, _category: Categories.STAFF }));
        const students = (appState.get('students') || []).map(p => ({ ...p, _category: Categories.STUDENTS }));
        const supporters = (appState.get('supporters') || []).map(p => ({ ...p, _category: Categories.SUPPORTERS }));
        return [...staff, ...students, ...supporters];
    },

    _findPerson(personId) {
        return this._allPeople.find(p => p.id === personId) || null;
    },

    // =========================================================
    //  Calendar Rendering
    // =========================================================

    _renderCalendar(container) {
        container.innerHTML = '';

        const today = new Date();
        const todayStr = this._dateStr(today);

        // Header
        const header = document.createElement('div');
        header.className = 'cal-header';

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        header.innerHTML = `
            <button class="cal-nav-btn" id="cal-prev" aria-label="Previous month">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 18l-6-6 6-6"/>
                </svg>
            </button>
            <div class="cal-month-label">${monthNames[this._currentMonth]} ${this._currentYear}</div>
            <button class="cal-nav-btn" id="cal-next" aria-label="Next month">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6"/>
                </svg>
            </button>
        `;
        container.appendChild(header);

        // Today button
        const todayBtn = document.createElement('button');
        todayBtn.className = 'cal-today-btn';
        todayBtn.textContent = 'Today';
        todayBtn.addEventListener('click', () => {
            this._currentMonth = today.getMonth();
            this._currentYear = today.getFullYear();
            this._renderCalendar(container);
        });
        container.appendChild(todayBtn);

        // Day-of-week header
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dowRow = document.createElement('div');
        dowRow.className = 'cal-dow-row';
        dayNames.forEach(d => {
            const cell = document.createElement('div');
            cell.className = 'cal-dow-cell';
            cell.textContent = d;
            dowRow.appendChild(cell);
        });
        container.appendChild(dowRow);

        // Calendar grid
        const grid = document.createElement('div');
        grid.className = 'cal-grid';

        const firstDay = new Date(this._currentYear, this._currentMonth, 1).getDay();
        const daysInMonth = new Date(this._currentYear, this._currentMonth + 1, 0).getDate();

        // Build a map of meetings by date for this month
        const meetingsByDate = {};
        this._meetings.forEach(m => {
            const d = new Date(m.date + 'T00:00:00');
            if (d.getMonth() === this._currentMonth && d.getFullYear() === this._currentYear) {
                if (!meetingsByDate[m.date]) meetingsByDate[m.date] = [];
                meetingsByDate[m.date].push(m);
            }
        });

        // Sort meetings within each date by time
        Object.keys(meetingsByDate).forEach(date => {
            meetingsByDate[date].sort((a, b) => a.time.localeCompare(b.time));
        });

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-cell cal-cell-empty';
            grid.appendChild(empty);
        }

        // Day cells
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${this._currentYear}-${String(this._currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const cell = document.createElement('div');
            cell.className = 'cal-cell';

            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;

            if (isToday) cell.classList.add('cal-cell-today');
            if (isPast) cell.classList.add('cal-cell-past');

            const dayNum = document.createElement('div');
            dayNum.className = 'cal-day-num';
            dayNum.textContent = day;
            cell.appendChild(dayNum);

            // Meeting names
            const dayMeetings = meetingsByDate[dateStr] || [];
            if (dayMeetings.length > 0) {
                const namesWrap = document.createElement('div');
                namesWrap.className = 'cal-day-meetings';

                const maxShow = 3;
                dayMeetings.slice(0, maxShow).forEach(m => {
                    const person = this._findPerson(m.personId);
                    const pill = document.createElement('div');
                    pill.className = 'cal-meeting-pill';
                    pill.textContent = person ? person.firstName || getFullName(person).split(' ')[0] : '?';
                    namesWrap.appendChild(pill);
                });

                if (dayMeetings.length > maxShow) {
                    const more = document.createElement('div');
                    more.className = 'cal-meeting-more';
                    more.textContent = `+${dayMeetings.length - maxShow}`;
                    namesWrap.appendChild(more);
                }

                cell.appendChild(namesWrap);
            }

            cell.addEventListener('click', () => {
                this._openDayDetail(dateStr);
            });

            grid.appendChild(cell);
        }

        container.appendChild(grid);

        // Bind nav
        container.querySelector('#cal-prev').addEventListener('click', () => {
            this._currentMonth--;
            if (this._currentMonth < 0) {
                this._currentMonth = 11;
                this._currentYear--;
            }
            this._renderCalendar(container);
        });

        container.querySelector('#cal-next').addEventListener('click', () => {
            this._currentMonth++;
            if (this._currentMonth > 11) {
                this._currentMonth = 0;
                this._currentYear++;
            }
            this._renderCalendar(container);
        });
    },

    // =========================================================
    //  Day Detail Modal
    // =========================================================

    _openDayDetail(dateStr) {
        const body = document.createElement('div');
        body.className = 'day-detail-view';

        this._renderDayDetailBody(body, dateStr);

        const d = parseLocalDate(dateStr);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        Modal.open({
            title: `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}`,
            body: body,
        });
    },

    _renderDayDetailBody(container, dateStr) {
        container.innerHTML = '';

        const todayStr = this._dateStr(new Date());

        // Add meeting button
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-primary btn-full';
        addBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Meeting
        `;
        addBtn.addEventListener('click', () => {
            this._openAddMeeting(dateStr, container);
        });
        container.appendChild(addBtn);

        // Get meetings for this date
        const dayMeetings = this._meetings
            .filter(m => m.date === dateStr)
            .sort((a, b) => a.time.localeCompare(b.time));

        if (dayMeetings.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state schedule-empty';
            empty.innerHTML = `
                <div class="empty-state-icon schedule-empty-icon">📅</div>
                <div class="empty-state-title">No meetings</div>
                <div class="empty-state-text">Tap "Add Meeting" to schedule one.</div>
            `;
            container.appendChild(empty);
            return;
        }

        const list = document.createElement('div');
        list.className = 'day-meeting-list day-meeting-list-spaced';

        dayMeetings.forEach(meeting => {
            const person = this._findPerson(meeting.personId);
            const item = document.createElement('div');
            item.className = 'day-meeting-item';

            const timeFormatted = this._formatTime(meeting.time);

            item.innerHTML = `
                <div class="day-meeting-time">${this._escapeHtml(timeFormatted)}</div>
                <div class="day-meeting-info">
                    <div class="day-meeting-person">${person ? this._escapeHtml(getFullName(person)) : 'Unknown'}</div>
                    ${meeting.location ? `<div class="day-meeting-location">📍 ${this._escapeHtml(meeting.location)}</div>` : ''}
                    ${meeting.notes ? `<div class="day-meeting-notes">${this._escapeHtml(meeting.notes)}</div>` : ''}
                    ${meeting.seriesId ? '<div class="day-meeting-repeat">🔁 Repeats weekly</div>' : ''}
                </div>
            `;

            item.addEventListener('click', () => {
                this._openMeetingOptions(meeting, dateStr, container);
            });

            list.appendChild(item);
        });

        container.appendChild(list);
    },

    // =========================================================
    //  Meeting Options (Edit / Delete)
    // =========================================================

    _openMeetingOptions(meeting, dateStr, dayContainer) {
        const person = this._findPerson(meeting.personId);
        const body = document.createElement('div');
        body.className = 'meeting-options-view';

        const timeFormatted = this._formatTime(meeting.time);
        const d = parseLocalDate(dateStr);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        body.innerHTML = `
            <div class="meeting-detail-card">
                <div class="meeting-detail-row">
                    <span class="meeting-detail-label">Person</span>
                    <span class="meeting-detail-value">${person ? this._escapeHtml(getFullName(person)) : 'Unknown'}</span>
                </div>
                <div class="meeting-detail-row">
                    <span class="meeting-detail-label">Date</span>
                    <span class="meeting-detail-value">${dayNames[d.getDay()]}, ${formatDate(dateStr)}</span>
                </div>
                <div class="meeting-detail-row">
                    <span class="meeting-detail-label">Time</span>
                    <span class="meeting-detail-value">${this._escapeHtml(timeFormatted)}</span>
                </div>
                ${meeting.location ? `
                <div class="meeting-detail-row">
                    <span class="meeting-detail-label">Location</span>
                    <span class="meeting-detail-value">${this._escapeHtml(meeting.location)}</span>
                </div>` : ''}
                ${meeting.notes ? `
                <div class="meeting-detail-row">
                    <span class="meeting-detail-label">Notes</span>
                    <span class="meeting-detail-value">${this._escapeHtml(meeting.notes)}</span>
                </div>` : ''}
                ${meeting.seriesId ? `
                <div class="meeting-detail-row">
                    <span class="meeting-detail-label">Repeat</span>
                    <span class="meeting-detail-value">Weekly${meeting.repeatEndDate ? ' until ' + formatDate(meeting.repeatEndDate) : ''}</span>
                </div>` : ''}
                <div class="meeting-detail-row">
                    <span class="meeting-detail-label">Reminder</span>
                    <span class="meeting-detail-value">${this._escapeHtml(this._describeReminder(meeting.reminder))}</span>
                </div>
            </div>

            <div class="meeting-actions">
                <button class="btn btn-secondary btn-full" id="meeting-edit-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit Meeting
                </button>
                <button class="btn btn-danger btn-full" id="meeting-delete-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                    Delete Meeting
                </button>
            </div>
        `;

        Modal.open({
            title: 'Meeting Details',
            body: body,
        });

        setTimeout(() => {
            document.getElementById('meeting-edit-btn')?.addEventListener('click', () => {
                Modal.close(); // close options
                this._openEditMeeting(meeting, dateStr, dayContainer);
            });

            document.getElementById('meeting-delete-btn')?.addEventListener('click', () => {
                this._handleDelete(meeting, dateStr, dayContainer);
            });
        }, 0);
    },

    // =========================================================
    //  Delete Logic
    // =========================================================

    async _handleDelete(meeting, dateStr, dayContainer) {
        const todayStr = this._dateStr(new Date());
        const isPast = dateStr < todayStr;

        if (!meeting.seriesId || isPast) {
            // Non-repeating, or past date → simple single delete
            const ok = await Dialog.confirm(
                'Delete this meeting?',
                'Delete Meeting'
            );
            if (!ok) return;

            await storage.deleteMeeting(meeting.id);
            await this._deleteMeetingReminder(meeting.id);
            this._meetings = await storage.getMeetings();
            Modal.close(); // close options modal
            this._renderDayDetailBody(dayContainer, dateStr);
            this._refreshCalendarBackground();
        } else {
            // Repeating + today or future
            this._showRepeatDeleteOptions(meeting, dateStr, dayContainer);
        }
    },

    async _showRepeatDeleteOptions(meeting, dateStr, dayContainer) {
        // Custom dialog with 3 options
        const body = document.createElement('div');
        body.className = 'repeat-delete-options';
        body.innerHTML = `
            <p class="repeat-delete-description">
                This is a repeating meeting. What would you like to delete?
            </p>
            <div class="repeat-delete-actions">
                <button class="btn btn-secondary btn-full" id="del-this-one">Delete This One Only</button>
                <button class="btn btn-danger btn-full" id="del-all-future">Delete All Future Meetings</button>
                <button class="btn btn-ghost btn-full" id="del-cancel">Cancel</button>
            </div>
        `;

        // Close the meeting options modal first
        Modal.close();

        Modal.open({
            title: 'Delete Repeating Meeting',
            body: body,
        });

        setTimeout(() => {
            document.getElementById('del-this-one')?.addEventListener('click', async () => {
                await storage.deleteMeeting(meeting.id);
                await this._deleteMeetingReminder(meeting.id);
                this._meetings = await storage.getMeetings();
                Modal.close(); // close delete options
                this._renderDayDetailBody(dayContainer, dateStr);
                this._refreshCalendarBackground();
            });

            document.getElementById('del-all-future')?.addEventListener('click', async () => {
                // Delete this meeting + all with same seriesId on dates >= dateStr
                const toDelete = this._meetings
                    .filter(m => m.seriesId === meeting.seriesId && m.date >= dateStr)
                    .map(m => m.id);
                await storage.deleteMeetings(toDelete);
                await this._deleteMeetingReminders(toDelete);
                this._meetings = await storage.getMeetings();
                Modal.close(); // close delete options
                this._renderDayDetailBody(dayContainer, dateStr);
                this._refreshCalendarBackground();
            });

            document.getElementById('del-cancel')?.addEventListener('click', () => {
                Modal.close();
            });
        }, 0);
    },

    // =========================================================
    //  Add Meeting
    // =========================================================

    _openAddMeeting(dateStr, dayContainer) {
        const body = this._buildMeetingForm(null, dateStr);

        Modal.open({
            title: 'Add Meeting',
            body: body,
        });

        setTimeout(() => {
            this._bindMeetingForm(null, dateStr, dayContainer);
        }, 0);
    },

    // =========================================================
    //  Edit Meeting
    // =========================================================

    _openEditMeeting(meeting, dateStr, dayContainer) {
        const body = this._buildMeetingForm(meeting, dateStr);

        Modal.open({
            title: 'Edit Meeting',
            body: body,
        });

        setTimeout(() => {
            this._bindMeetingForm(meeting, dateStr, dayContainer);
        }, 0);
    },

    // =========================================================
    //  Meeting Form
    // =========================================================

    _buildMeetingForm(existingMeeting, dateStr) {
        const isEdit = !!existingMeeting;
        const body = document.createElement('div');
        body.className = 'meeting-form';

        const personName = existingMeeting ? (() => {
            const p = this._findPerson(existingMeeting.personId);
            return p ? getFullName(p) : '';
        })() : '';

        body.innerHTML = `
            <form id="meeting-form">
                <div class="form-group">
                    <label class="form-label">Person *</label>
                    <div class="meeting-person-select">
                        <input type="hidden" id="mtg-person-id" value="${existingMeeting?.personId || ''}">
                        <input type="hidden" id="mtg-person-category" value="${existingMeeting?.personCategory || ''}">
                        <button type="button" class="form-input meeting-person-btn" id="mtg-select-person">
                            ${personName ? this._escapeHtml(personName) : '<span class="meeting-person-placeholder">Select a person…</span>'}
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="mtg-date">Date</label>
                    <input type="date" class="form-input" id="mtg-date" value="${dateStr}" required>
                </div>

                <div class="form-group">
                    <label class="form-label" for="mtg-time">Time</label>
                    <input type="time" class="form-input" id="mtg-time" value="${existingMeeting?.time || '09:00'}" required>
                </div>

                <div class="form-group">
                    <label class="form-label" for="mtg-location">Location</label>
                    <input type="text" class="form-input" id="mtg-location" placeholder="e.g. Coffee shop, Office" value="${this._escapeHtml(existingMeeting?.location || '')}">
                </div>

                <div class="form-group">
                    <label class="form-label" for="mtg-notes">Additional Notes</label>
                    <textarea class="form-input" id="mtg-notes" rows="3" placeholder="Optional notes about the meeting...">${this._escapeHtml(existingMeeting?.notes || '')}</textarea>
                </div>

                <div class="form-group">
                    <label class="form-label" for="mtg-reminder-mode">Reminder</label>
                    <select class="form-input" id="mtg-reminder-mode">
                        ${this._renderReminderOptions(existingMeeting?.reminder)}
                    </select>
                    <div class="meeting-reminder-custom" id="mtg-reminder-custom-wrap">
                        <label class="form-label" for="mtg-reminder-custom">Custom Reminder Time</label>
                        <input type="datetime-local" class="form-input" id="mtg-reminder-custom" value="${this._escapeHtml(this._customReminderValue(existingMeeting?.reminder))}">
                    </div>
                    <p class="meeting-reminder-help">
                        Reminders use this device's PWA notification permission. The server stores only the reminder time and meeting id.
                    </p>
                </div>

                ${!isEdit ? `
                <div class="form-group">
                    <div class="settings-item meeting-repeat-toggle">
                        <div class="settings-item-info">
                            <div class="settings-item-title">Repeat Weekly</div>
                            <div class="settings-item-desc">Meeting will repeat every week</div>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="mtg-repeat">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="repeat-end-wrap" id="mtg-repeat-end-wrap">
                        <label class="form-label" for="mtg-repeat-end">End Date (optional)</label>
                        <input type="date" class="form-input" id="mtg-repeat-end" value="">
                    </div>
                </div>
                ` : ''}

                <div class="edit-sticky-actions">
                    <button type="submit" class="detail-action-item">
                        <div class="detail-action-icon detail-action-icon--primary">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M20 6L9 17l-5-5"/>
                            </svg>
                        </div>
                        <span class="detail-action-label">${isEdit ? 'Save' : 'Add to Schedule'}</span>
                    </button>
                    <button type="button" class="detail-action-item" id="mtg-cancel">
                        <div class="detail-action-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </div>
                        <span class="detail-action-label">Cancel</span>
                    </button>
                </div>
            </form>
        `;

        return body;
    },

    _bindMeetingForm(existingMeeting, dateStr, dayContainer) {
        const isEdit = !!existingMeeting;

        // Person picker
        document.getElementById('mtg-select-person')?.addEventListener('click', () => {
            this._openMeetingPersonPicker();
        });

        // Toggle repeat end date
        const repeatCheck = document.getElementById('mtg-repeat');
        const repeatEndWrap = document.getElementById('mtg-repeat-end-wrap');
        if (repeatCheck && repeatEndWrap) {
            repeatCheck.addEventListener('change', () => {
                repeatEndWrap.style.display = repeatCheck.checked ? '' : 'none';
            });
        }

        const reminderMode = document.getElementById('mtg-reminder-mode');
        const reminderCustomWrap = document.getElementById('mtg-reminder-custom-wrap');
        const updateReminderCustomVisibility = () => {
            if (reminderCustomWrap && reminderMode) {
                reminderCustomWrap.style.display = reminderMode.value === 'custom' ? '' : 'none';
            }
        };
        reminderMode?.addEventListener('change', updateReminderCustomVisibility);
        updateReminderCustomVisibility();

        // Cancel
        document.getElementById('mtg-cancel')?.addEventListener('click', () => {
            Modal.close();
        });

        // Submit
        document.getElementById('meeting-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();

            const personId = document.getElementById('mtg-person-id').value;
            const personCategory = document.getElementById('mtg-person-category').value;
            const date = document.getElementById('mtg-date').value;
            const time = document.getElementById('mtg-time').value;
            const location = document.getElementById('mtg-location').value.trim();
            const notes = document.getElementById('mtg-notes').value.trim();
            const reminder = this._readReminderFromForm(date, time);

            if (!personId) {
                await Dialog.alert('Please select a person.', 'Required');
                return;
            }
            if (!date || !time) {
                await Dialog.alert('Please set date and time.', 'Required');
                return;
            }
            if (reminder.enabled && reminder.mode === 'custom' && !reminder.customDateTime) {
                await Dialog.alert('Please choose a custom reminder time.', 'Reminder Required');
                return;
            }
            if (reminder.enabled && !this._isReminderBeforeMeeting(date, time, reminder)) {
                await Dialog.alert('Reminder time must be before or at the meeting time.', 'Invalid Reminder');
                return;
            }

            let reminderSynced = true;
            if (isEdit) {
                // Update existing
                existingMeeting.personId = personId;
                existingMeeting.personCategory = personCategory;
                existingMeeting.date = date;
                existingMeeting.time = time;
                existingMeeting.location = location;
                existingMeeting.notes = notes;
                existingMeeting.reminder = reminder;
                await storage.saveMeeting(existingMeeting);
                reminderSynced = await this._syncMeetingReminder(existingMeeting);
            } else {
                const repeatsWeekly = repeatCheck?.checked || false;
                const repeatEndDate = document.getElementById('mtg-repeat-end')?.value || '';

                if (repeatsWeekly) {
                    // Generate weekly instances
                    const seriesId = Date.now().toString() + Math.random().toString(36).slice(2, 6);
                    const startDate = parseLocalDate(date);
                    const endDate = repeatEndDate
                        ? parseLocalDate(repeatEndDate)
                        : new Date(startDate.getTime() + 52 * 7 * 24 * 60 * 60 * 1000); // 1 year

                    const meetings = [];
                    let current = new Date(startDate);
                    while (current <= endDate) {
                        meetings.push(createMeeting({
                            personId,
                            personCategory,
                            date: this._dateStr(current),
                            time,
                            location,
                            notes,
                            repeatsWeekly: true,
                            repeatEndDate,
                            seriesId,
                            reminder
                        }));
                        current.setDate(current.getDate() + 7);
                    }
                    await storage.saveMeetings(meetings);
                    reminderSynced = await this._syncMeetingReminders(meetings);
                } else {
                    const meeting = createMeeting({
                        personId,
                        personCategory,
                        date,
                        time,
                        location,
                        notes,
                        reminder
                    });
                    await storage.saveMeeting(meeting);
                    reminderSynced = await this._syncMeetingReminder(meeting);
                }
            }

            this._meetings = await storage.getMeetings();
            Modal.close(); // close form

            // Refresh the day detail if it's still open
            this._renderDayDetailBody(dayContainer, isEdit ? existingMeeting.date : dateStr);
            this._refreshCalendarBackground();

            if (!reminderSynced && reminder.enabled) {
                const reason = typeof ReminderManager !== 'undefined' ? ReminderManager.lastFailureMessage() : '';
                const message = reason
                    ? `The meeting was saved, but the reminder could not be scheduled. ${reason}`
                    : 'The meeting was saved, but the reminder could not be scheduled on this device.';
                await Dialog.alert(message, 'Reminder Not Scheduled');
            }
        });
    },

    _renderReminderOptions(reminder) {
        const normalized = normalizeMeetingReminder(reminder);
        const selected = normalized.enabled ? normalized.mode : 'none';
        const options = [
            ['none', 'No reminder'],
            ['0', 'At meeting time'],
            ['5', '5 minutes before'],
            ['10', '10 minutes before'],
            ['15', '15 minutes before'],
            ['30', '30 minutes before'],
            ['60', '1 hour before'],
            ['1440', '1 day before'],
            ['custom', 'Custom time...']
        ];

        return options.map(([value, label]) => (
            `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`
        )).join('');
    },

    _customReminderValue(reminder) {
        const normalized = normalizeMeetingReminder(reminder);
        if (normalized.mode !== 'custom' || !normalized.customDateTime) return '';

        const date = new Date(normalized.customDateTime);
        if (Number.isNaN(date.getTime())) return normalized.customDateTime;

        const pad = value => String(value).padStart(2, '0');
        return [
            date.getFullYear(),
            pad(date.getMonth() + 1),
            pad(date.getDate())
        ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    },

    _readReminderFromForm(date, time) {
        const mode = document.getElementById('mtg-reminder-mode')?.value || 'none';
        if (mode === 'none') return normalizeMeetingReminder(null);

        if (mode === 'custom') {
            return normalizeMeetingReminder({
                enabled: true,
                mode,
                offsetMinutes: null,
                customDateTime: document.getElementById('mtg-reminder-custom')?.value || ''
            });
        }

        const offsetMinutes = Number(mode);
        return normalizeMeetingReminder({
            enabled: true,
            mode,
            offsetMinutes,
            customDateTime: ''
        });
    },

    _isReminderBeforeMeeting(date, time, reminder) {
        const meetingTime = new Date(`${date}T${time}`);
        if (Number.isNaN(meetingTime.getTime())) return false;

        const reminderTime = reminder.mode === 'custom'
            ? new Date(reminder.customDateTime)
            : new Date(meetingTime.getTime() - Number(reminder.offsetMinutes || 0) * 60 * 1000);

        return !Number.isNaN(reminderTime.getTime()) && reminderTime <= meetingTime;
    },

    _describeReminder(reminder) {
        if (typeof ReminderManager !== 'undefined') {
            return ReminderManager.describeReminder(reminder);
        }
        return normalizeMeetingReminder(reminder).enabled ? 'Reminder enabled' : 'No reminder';
    },

    async _syncMeetingReminder(meeting) {
        if (typeof ReminderManager === 'undefined') return true;
        try {
            return await ReminderManager.syncMeeting(meeting);
        } catch (error) {
            console.warn('Could not sync meeting reminder:', error);
            return false;
        }
    },

    async _syncMeetingReminders(meetings) {
        if (typeof ReminderManager === 'undefined') return true;
        try {
            return await ReminderManager.syncMeetings(meetings);
        } catch (error) {
            console.warn('Could not sync meeting reminders:', error);
            return false;
        }
    },

    async _deleteMeetingReminder(meetingId) {
        if (typeof ReminderManager === 'undefined') return;
        await ReminderManager.deleteMeeting(meetingId);
    },

    async _deleteMeetingReminders(meetingIds) {
        if (typeof ReminderManager === 'undefined') return;
        await ReminderManager.deleteMeetings(meetingIds);
    },

    // =========================================================
    //  Person Picker (for meeting form)
    // =========================================================

    _openMeetingPersonPicker() {
        const body = document.createElement('div');
        body.className = 'person-picker';

        const staff = (appState.get('staff') || []).filter(p => !p.isArchived);
        const students = (appState.get('students') || []).filter(p => !p.isArchived);
        const supporters = (appState.get('supporters') || []).filter(p => !p.isArchived);

        body.innerHTML = `
            <div class="person-picker-header">
                <input type="text" class="form-input person-picker-search" id="mtg-picker-search" placeholder="Search people...">
            </div>
            <div class="person-picker-list" id="mtg-picker-list"></div>
        `;

        Modal.open({
            title: 'Select Person',
            body: body,
        });

        const renderList = (filter = '') => {
            const listEl = document.getElementById('mtg-picker-list');
            if (!listEl) return;
            listEl.innerHTML = '';

            const filterLower = filter.toLowerCase();
            const groups = [
                { label: CategoryLabels[Categories.STAFF], category: Categories.STAFF, people: staff },
                { label: CategoryLabels[Categories.STUDENTS], category: Categories.STUDENTS, people: students },
                { label: CategoryLabels[Categories.SUPPORTERS], category: Categories.SUPPORTERS, people: supporters },
            ];

            let anyShown = false;

            groups.forEach(group => {
                const filtered = group.people.filter(p => {
                    const name = getFullName(p).toLowerCase();
                    return !filter || name.includes(filterLower);
                });

                if (filtered.length === 0) return;
                anyShown = true;

                const header = document.createElement('div');
                header.className = 'person-picker-group-header';
                header.textContent = group.label;
                listEl.appendChild(header);

                filtered.forEach(person => {
                    const item = document.createElement('button');
                    item.className = 'person-picker-item';

                    const avatarContent = person.profilePicture
                        ? `<img class="person-picker-avatar-img" src="${person.profilePicture}" alt="">`
                        : getInitials(person);

                    item.innerHTML = `
                        <div class="person-picker-avatar">${avatarContent}</div>
                        <div class="person-picker-name">${this._escapeHtml(getFullName(person))}</div>
                    `;

                    item.addEventListener('click', () => {
                        // Set the hidden inputs and update the button text
                        document.getElementById('mtg-person-id').value = person.id;
                        document.getElementById('mtg-person-category').value = group.category;

                        const btn = document.getElementById('mtg-select-person');
                        if (btn) btn.textContent = getFullName(person);

                        Modal.close(); // close picker
                    });

                    listEl.appendChild(item);
                });
            });

            if (!anyShown) {
                listEl.innerHTML = `
                    <div class="empty-state schedule-picker-empty">
                        <div class="empty-state-text">${filter ? 'No matching people found' : 'No people added yet'}</div>
                    </div>
                `;
            }
        };

        setTimeout(() => {
            renderList();
            document.getElementById('mtg-picker-search')?.addEventListener('input', (e) => {
                renderList(e.target.value);
            });
        }, 0);
    },

    // =========================================================
    //  Navigation from Person Profile
    // =========================================================

    /**
     * Open a specific meeting from a person's profile.
     * Navigates to schedule view and opens the meeting detail.
     */
    async openMeetingFromProfile(meetingId) {
        // Switch to schedule tab
        appState.set('currentView', 'schedule');
        Navigation.updateActiveState('schedule');

        await this.render();

        // Find the meeting
        const meeting = this._meetings.find(m => m.id === meetingId);
        if (!meeting) return;

        // Navigate to the right month
        const d = parseLocalDate(meeting.date);
        this._currentMonth = d.getMonth();
        this._currentYear = d.getFullYear();

        const container = document.getElementById('schedule-view');
        if (container) this._renderCalendar(container);

        // Open the day detail
        setTimeout(() => {
            this._openDayDetail(meeting.date);
        }, 100);
    },

    // =========================================================
    //  Helpers
    // =========================================================

    /**
     * Get the next upcoming meeting for a person
     */
    getNextMeetingForPerson(personId) {
        const todayStr = this._dateStr(new Date());
        const upcoming = this._meetings
            .filter(m => m.personId === personId && m.date >= todayStr)
            .sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                return a.time.localeCompare(b.time);
            });
        return upcoming.length > 0 ? upcoming[0] : null;
    },

    /**
     * Ensure meetings data is loaded (called from personDetail)
     */
    async ensureMeetingsLoaded() {
        if (this._meetings.length === 0) {
            this._meetings = await storage.getMeetings();
            this._allPeople = this._gatherPeople();
        }
    },

    _refreshCalendarBackground() {
        const container = document.getElementById('schedule-view');
        if (container) this._renderCalendar(container);
    },

    _dateStr(date) {
        return toLocalDateString(date);
    },

    _formatTime(timeStr) {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
    },

    _escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
};
