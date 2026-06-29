const { loadScript } = require('./helpers/loadScript');

loadScript('js/pinAuth.js');
loadScript('js/components/pinScreen.js');

describe('PinScreen assumptive node selection', () => {
    beforeEach(() => {
        PinScreen.nodes = [];
        PinScreen.selectedNodes = [];
        PinScreen.implicitNodeIndexes = new Set();
        PinScreen._initializeNodes();
    });

    const selectedIndexes = () => PinScreen.selectedNodes.map(node => node.index);
    const implicitIndexes = () => Array.from(PinScreen.implicitNodeIndexes);

    test('selects the middle node when swiping horizontally across it', () => {
        PinScreen._selectNode(PinScreen.nodes[0]);
        PinScreen._selectNodeWithSkippedNodes(PinScreen.nodes[2]);

        expect(selectedIndexes()).toEqual([0, 1, 2]);
        expect(implicitIndexes()).toEqual([1]);
    });

    test('selects the middle node when swiping vertically across it', () => {
        PinScreen._selectNode(PinScreen.nodes[0]);
        PinScreen._selectNodeWithSkippedNodes(PinScreen.nodes[6]);

        expect(selectedIndexes()).toEqual([0, 3, 6]);
        expect(implicitIndexes()).toEqual([3]);
    });

    test('selects the center node when swiping diagonally across it', () => {
        PinScreen._selectNode(PinScreen.nodes[0]);
        PinScreen._selectNodeWithSkippedNodes(PinScreen.nodes[8]);

        expect(selectedIndexes()).toEqual([0, 4, 8]);
        expect(implicitIndexes()).toEqual([4]);
    });

    test('does not insert a node when the movement does not pass through one', () => {
        PinScreen._selectNode(PinScreen.nodes[0]);
        PinScreen._selectNodeWithSkippedNodes(PinScreen.nodes[5]);

        expect(selectedIndexes()).toEqual([0, 5]);
        expect(implicitIndexes()).toEqual([]);
    });

    test('does not mark an explicitly selected middle node as implicit', () => {
        PinScreen._selectNode(PinScreen.nodes[0]);
        PinScreen._selectNode(PinScreen.nodes[1]);
        PinScreen._selectNodeWithSkippedNodes(PinScreen.nodes[2]);

        expect(selectedIndexes()).toEqual([0, 1, 2]);
        expect(implicitIndexes()).toEqual([]);
    });

    test('can produce a legacy pattern without implicitly selected nodes', () => {
        PinScreen._selectNode(PinScreen.nodes[0]);
        PinScreen._selectNodeWithSkippedNodes(PinScreen.nodes[2]);
        PinScreen._selectNodeWithSkippedNodes(PinScreen.nodes[8]);

        expect(selectedIndexes()).toEqual([0, 1, 2, 5, 8]);
        expect(PinScreen._getLegacyPattern(selectedIndexes())).toEqual([0, 2, 8]);
    });
});
