import { callbackify, promisify } from "node:util";
import { assetManager } from "../../exports/base";
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { IConfigOption } from "../../cocos/asset/asset-manager/config";
import { DownloadHandler } from "../../cocos/asset/asset-manager/downloader";

jest.setTimeout(1000 * 10);

const restoreTasks: Array<() => void> = [];

afterEach(() => {
    restoreTasks.reverse().forEach(task => task());
});

function registerAutoRestoredHandler(type: string, handler: DownloadHandler) {
    const oldHandler = assetManager.downloader.handlers[type];
    assetManager.downloader.register(type, handler);
    restoreTasks.push(() => {
        assetManager.downloader.register(type, oldHandler);
    });
}

it('bundle downloading should prefer registered download handlers', async () => {
    assetManager.downloader.retryInterval = 0;
    assetManager.downloader.maxRetryCount = 0;
    registerAutoRestoredHandler('.json', callbackify(async (url: string, _options: Record<string, unknown>) => {
        if (url.endsWith('/x/config.json')) {
            return {
                importBase: "",
                nativeBase: "",
                base: "",
                name: "",
                deps: [],
                uuids: [],
                paths: {},
                scenes: {},
                packs: {},
                versions: {
                    import: [],
                    native: []
                },
                redirect: [],
                debug: false,
                types: [],
                extensionMap: {}
            } as IConfigOption;
        }
        throw new Error('not implemented');
    }));
    registerAutoRestoredHandler('.js', callbackify(async (url: string, _options: Record<string, unknown>) => {
        if (url.endsWith('/x/index.js')) {
            return {};
        }
        throw new Error('not implemented');
    }));

    await promisify(assetManager.loadBundle).call(assetManager, 'x');
});

describe('download legacy apis', () => {
    it('Downloader._downloadJson()', () => {
        expect(assetManager.downloader._downloadJson).toBe(assetManager.downloader.handlers['.json']);
        const downloadJson = callbackify(async (url: string, _options: Record<string, unknown>) => {});
        registerAutoRestoredHandler('.json', downloadJson);
        expect(assetManager.downloader._downloadJson).toBe(downloadJson);
    });

    it('Downloader.downloadScript()', () => {
        expect(assetManager.downloader.downloadScript).toBe(assetManager.downloader.handlers['.js']);
        const downloadScript = callbackify(async (url: string, _options: Record<string, unknown>) => {});
        registerAutoRestoredHandler('.js', downloadScript);
        expect(assetManager.downloader.downloadScript).toBe(downloadScript);
    });
});
