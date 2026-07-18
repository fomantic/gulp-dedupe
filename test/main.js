const test = require('node:test');
const assert = require('node:assert');
const dedupe = require('../');
const path = require('path');
const Vinyl = require('vinyl');
const Buffer = require('buffer').Buffer;

testDedupe(
    undefined,
    [
        'file1.txt', 'Contents1',
        'file1.txt', 'Contents1',
        'file2.txt', 'Contents2',
        'file1.txt', 'Contents1',
        'file2.txt', 'Contents2',
        'file3.txt', 'Contents3',
        'file4.txt', 'Contents4',
        'test/file1.txt', 'Contents1',
        'file4.txt', 'Contents4'
    ],
    [
        'file1.txt', 'Contents1',
        'file2.txt', 'Contents2',
        'file3.txt', 'Contents3',
        'file4.txt', 'Contents4',
        'test/file1.txt', 'Contents1'
    ]
);

testDedupe(
    { error: true },
    [
        'file1.txt', 'Contents1',
        'file1.txt', 'Contents1'
    ],
    [
        'file1.txt', 'Contents1', 'Duplicate `file1.txt`'
    ]
);

testDedupe(
    undefined,
    [
        'file1.txt', 'Contents1',
        'file1.txt', 'Contents2'
    ],
    [
        'file1.txt', 'Contents1', 'Duplicate file `file1.txt` with different contents'
    ]
);

testDedupe(
    { diff: true },
    [
        'file1.txt', 'Contents1',
        'file1.txt', 'Contents2'
    ],
    [
        'file1.txt', 'Contents1', 'Duplicate file `file1.txt` with different contents:\n'
    ]
);

testDedupe(
    { same: false },
    [
        'file1.txt', 'Contents1',
        'file1.txt', 'Contents2'
    ],
    [
        'file1.txt', 'Contents1'
    ]
);

function testDedupe(options, filesInput, resultsInput) {
    test('should dedupe files', { timeout: 5000 }, async () => {
        const stream = dedupe(options);

        const files = filesInput.slice();
        let results = resultsInput.slice();

        await new Promise((resolve, reject) => {
            stream.on('data', (file) => {
                const expectedFilename = path.normalize(results.shift());
                const expectedHead = results.shift();

                assert.ok(file);
                assert.ok(file.relative);
                assert.ok(file.contents);
                assert.ok(expectedFilename);
                assert.ok(expectedHead);

                const retFilename = path.resolve(file.path);

                assert.strictEqual(
                    retFilename,
                    path.resolve(expectedFilename)
                );

                assert.strictEqual(
                    file.relative,
                    expectedFilename
                );

                assert.strictEqual(
                    Buffer.isBuffer(file.contents),
                    true
                );

                assert.strictEqual(
                    file.contents
                        .toString()
                        .substring(0, expectedHead.length),
                    expectedHead
                );

                if (!results.length) {
                    results = null;
                    resolve();
                }
            });

            stream.on('error', (err) => {
                const expected = results.shift();
                const msg = (err.message || '').substring(0, expected.length);

                try {
                    assert.strictEqual(msg, expected);
                } catch (e) {
                    reject(e);
                    return;
                }
            });

            stream.on('end', () => {
                if (results && !results.length) {
                    resolve();
                }
            });

            while (files.length) {
                stream.write(
                    new Vinyl({
                        path: files.shift(),
                        contents: Buffer.from(files.shift())
                    })
                );
            }

            stream.end();

            if (results && !results.length) {
                resolve();
            }
        });
    });
}
