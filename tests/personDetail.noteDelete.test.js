const { loadScript } = require('./helpers/loadScript');

loadScript('js/components/personDetail.js');

describe('PersonDetail note deletion', () => {
    let originalDialog;
    let originalSyncEditorValues;
    let originalRefreshNotes;
    let originalDeleteNoteAtIndex;

    beforeEach(() => {
        document.body.innerHTML = '';

        originalDialog = global.Dialog;
        originalSyncEditorValues = PersonDetail._syncEditorValues;
        originalRefreshNotes = PersonDetail._refreshNotes;
        originalDeleteNoteAtIndex = PersonDetail._deleteNoteAtIndex;

        global.Dialog = {
            confirm: jest.fn(),
        };
        PersonDetail._syncEditorValues = jest.fn();
        PersonDetail._refreshNotes = jest.fn();
    });

    afterEach(() => {
        global.Dialog = originalDialog;
        PersonDetail._syncEditorValues = originalSyncEditorValues;
        PersonDetail._refreshNotes = originalRefreshNotes;
        PersonDetail._deleteNoteAtIndex = originalDeleteNoteAtIndex;
        jest.clearAllMocks();
    });

    test('confirmed delete removes only the selected note', async () => {
        const person = {
            notes: [
                { id: 'n1', content: '<p>Alpha</p>' },
                { id: 'n2', content: '<p>Beta</p>' },
                { id: 'n3', content: '<p>Gamma</p>' },
            ],
        };

        Dialog.confirm.mockResolvedValue(true);

        const deleted = await PersonDetail._deleteNoteAtIndex(person, 1);

        expect(deleted).toBe(true);
        expect(Dialog.confirm).toHaveBeenCalledWith(
            'Are you sure you want to delete this note? This action cannot be undone.',
            'Delete Note'
        );
        expect(person.notes.map(n => n.id)).toEqual(['n1', 'n3']);
        expect(PersonDetail._syncEditorValues).toHaveBeenCalledWith(person);
        expect(PersonDetail._refreshNotes).toHaveBeenCalledWith(person, { syncEditors: false });
    });

    test('cancelled delete leaves notes unchanged', async () => {
        const person = {
            notes: [
                { id: 'n1', content: '<p>Alpha</p>' },
                { id: 'n2', content: '<p>Beta</p>' },
            ],
        };

        Dialog.confirm.mockResolvedValue(false);

        const deleted = await PersonDetail._deleteNoteAtIndex(person, 1);

        expect(deleted).toBe(false);
        expect(person.notes.map(n => n.id)).toEqual(['n1', 'n2']);
        expect(PersonDetail._syncEditorValues).not.toHaveBeenCalled();
        expect(PersonDetail._refreshNotes).not.toHaveBeenCalled();
    });

    test('invalid index is ignored', async () => {
        const person = {
            notes: [
                { id: 'n1', content: '<p>Alpha</p>' },
            ],
        };

        const deleted = await PersonDetail._deleteNoteAtIndex(person, 9);

        expect(deleted).toBe(false);
        expect(Dialog.confirm).not.toHaveBeenCalled();
        expect(person.notes.map(n => n.id)).toEqual(['n1']);
    });

    test('remove button delegates to delete helper with parsed index', async () => {
        const person = {
            notes: [
                { id: 'n1', content: '<p>Alpha</p>' },
                { id: 'n2', content: '<p>Beta</p>' },
                { id: 'n3', content: '<p>Gamma</p>' },
            ],
        };

        document.body.innerHTML = `
            <div>
                <button type="button" data-note-remove="2"></button>
            </div>
        `;

        const deleteSpy = jest.fn().mockResolvedValue(true);
        PersonDetail._deleteNoteAtIndex = deleteSpy;

        PersonDetail._bindNoteRemoveButtons(person);
        document.querySelector('[data-note-remove="2"]').click();
        await Promise.resolve();

        expect(deleteSpy).toHaveBeenCalledWith(person, 2);
    });
});
