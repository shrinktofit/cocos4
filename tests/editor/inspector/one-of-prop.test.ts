const oneOfProp = require('../../../editor/inspector/utils/one-of-prop');

describe('inspector oneOf prop', () => {
    test('switching oneOf duck does not submit the sibling complex oneOf value', () => {
        const outerPanel = document.createElement('ui-panel');
        const outerShadow = outerPanel.attachShadow({ mode: 'open' });
        const componentPanel = document.createElement('ui-panel');
        const componentShadow = componentPanel.attachShadow({ mode: 'open' });
        const events: string[] = [];
        const duckDump = {
            name: 'oneOfDuck',
            path: '__comps__.0.oneOfDuck',
            type: 'OneOf',
            value: {},
            userData: {
                oneOf: {
                    currentVariantIndex: 0,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_oneOfDuck',
                    switchType: 'String',
                    variants: [
                        { branch: 'dog', creatable: true },
                        { branch: 'cat', creatable: true },
                    ],
                },
            },
        };
        const complexDump = {
            name: 'complexOneOf',
            path: '__comps__.0.complexOneOf',
            type: 'Number',
            value: 0,
            userData: {
                oneOf: {
                    currentVariantIndex: 2,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_complexOneOf',
                    switchType: 'String',
                    variants: [
                        { branch: 'dog', type: 'Dog', creatable: true },
                        { branch: 'cat', type: 'Cat', creatable: true },
                        { branch: 'number', type: 'Number', creatable: true },
                        { branch: 'string', type: 'String', creatable: true },
                    ],
                },
            },
        };
        const $duckProp = document.createElement('ui-prop');
        const $complexProp = document.createElement('ui-prop');

        componentPanel.dump = {
            path: '__comps__.0',
            value: {
                oneOfDuck: duckDump,
                complexOneOf: complexDump,
            },
        };
        $duckProp.dump = duckDump;
        $complexProp.dump = complexDump;

        componentShadow.appendChild($duckProp);
        componentShadow.appendChild($complexProp);
        outerShadow.appendChild(componentPanel);
        document.body.appendChild(outerPanel);

        componentShadow.addEventListener('change-dump', (event) => {
            events.push((event.target as HTMLElement & { dump?: { path?: string } }).dump?.path || '');
        });
        outerShadow.addEventListener('change-dump', (event) => {
            events.push((event.target as HTMLElement & { dump?: { path?: string } }).dump?.path || '');
        });

        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $duckProp, duckDump);
        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $complexProp, complexDump);

        $duckProp.$oneOfSelect.value = '1';
        $duckProp.$oneOfSelect.dispatchEvent(new CustomEvent('change', {
            bubbles: true,
            cancelable: true,
        }));

        expect(events).toStrictEqual([
            '__comps__.0.__cc_oneOfSwitch_oneOfDuck',
        ]);
    });

    test('restores the label slot when a oneOf object renderer switches to a primitive renderer', () => {
        const numberDump = {
            name: 'complexOneOf',
            path: '__comps__.0.complexOneOf',
            type: 'Number',
            value: 0,
            userData: {
                oneOf: {
                    currentVariantIndex: 2,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_complexOneOf',
                    switchType: 'String',
                    variants: [
                        { branch: 'dog', type: 'Dog', creatable: true },
                        { branch: 'cat', type: 'Cat', creatable: true },
                        { branch: 'number', type: 'Number', creatable: true },
                        { branch: 'string', type: 'String', creatable: true },
                    ],
                },
            },
        };
        const $prop = document.createElement('ui-prop');

        $prop.setAttribute('no-label', '');
        $prop.innerHTML = `
            <ui-label slot="label" style="flex: 1;"></ui-label>
            <ui-num-input slot="content"></ui-num-input>
        `;

        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $prop, numberDump);

        expect($prop.hasAttribute('no-label')).toBe(false);
        expect($prop.$oneOfSelect.getAttribute('slot')).toBe('label');
    });

    test('keeps oneOf root label placement aligned with normal prop rows', () => {
        const dump = {
            name: 'complexOneOf',
            path: '__comps__.0.complexOneOf',
            type: 'Custom',
            value: 0,
            userData: {
                oneOf: {
                    currentVariantIndex: 2,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_complexOneOf',
                    switchType: 'String',
                    variants: [
                        { branch: 'dog', type: 'Dog', creatable: true },
                        { branch: 'cat', type: 'Cat', creatable: true },
                        { branch: 'number', type: 'Number', creatable: true },
                    ],
                },
            },
        };
        const $prop = document.createElement('ui-prop');

        $prop.innerHTML = `
            <ui-label slot="label"></ui-label>
            <custom-renderer-value slot="content"></custom-renderer-value>
        `;

        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $prop, dump);

        expect($prop.$oneOfLabelGutter).toBeUndefined();
        expect($prop.firstElementChild?.tagName).toBe('UI-LABEL');
        expect($prop.$oneOfSelect.previousElementSibling?.tagName).toBe('UI-LABEL');

        $prop.innerHTML = `
            <ui-section expand>
                <div slot="header">
                    <ui-label name></ui-label>
                    <ui-label type></ui-label>
                </div>
            </ui-section>
        `;

        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $prop, dump);

        expect($prop.$oneOfSelect.getAttribute('slot')).toBeNull();
    });

    test('reapplies oneOf placement when the current renderer remounts after decoration', async () => {
        const dump = {
            name: 'complexOneOf',
            path: '__comps__.0.complexOneOf',
            type: 'Custom',
            value: 0,
            userData: {
                oneOf: {
                    currentVariantIndex: 2,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_complexOneOf',
                    switchType: 'String',
                    variants: [
                        { branch: 'dog', type: 'Dog', creatable: true },
                        { branch: 'cat', type: 'Cat', creatable: true },
                        { branch: 'number', type: 'Number', creatable: true },
                    ],
                },
            },
        };
        const $prop = document.createElement('ui-prop');

        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $prop, dump);

        $prop.innerHTML = `
            <ui-label slot="label"></ui-label>
            <custom-renderer-value slot="content"></custom-renderer-value>
        `;
        await Promise.resolve();

        expect($prop.$oneOfLabelGutter).toBeUndefined();
        expect($prop.$oneOfSelect.parentElement).toBe($prop);
        expect($prop.$oneOfSelect.previousElementSibling?.tagName).toBe('UI-LABEL');
        expect($prop.$oneOfSelect.getAttribute('slot')).toBe('label');
    });

    test('clears object-renderer host style when switching back to a root-label oneOf renderer', () => {
        const dump = {
            name: 'complexOneOf',
            path: '__comps__.0.complexOneOf',
            type: 'Custom',
            value: 0,
            userData: {
                oneOf: {
                    currentVariantIndex: 2,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_complexOneOf',
                    switchType: 'String',
                    variants: [
                        { branch: 'dog', type: 'Dog', creatable: true },
                        { branch: 'cat', type: 'Cat', creatable: true },
                        { branch: 'number', type: 'Number', creatable: true },
                    ],
                },
            },
        };
        const $prop = document.createElement('ui-prop');
        $prop.attachShadow({ mode: 'open' }).innerHTML = '<style id="custom-style"></style>';

        $prop.innerHTML = `
            <ui-label slot="label"></ui-label>
            <custom-renderer-value slot="content"></custom-renderer-value>
        `;
        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $prop, dump);

        $prop.shadowRoot.querySelector('#custom-style').innerHTML = ':host { margin-left: 0; }';
        $prop.innerHTML = `
            <ui-section expand>
                <div slot="header">
                    <ui-label name></ui-label>
                    <ui-label type></ui-label>
                </div>
            </ui-section>
        `;
        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $prop, dump);

        $prop.innerHTML = `
            <ui-label slot="label"></ui-label>
            <custom-renderer-value slot="content"></custom-renderer-value>
        `;
        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $prop, dump);

        expect($prop.shadowRoot.querySelector('#custom-style').innerHTML).toBe('');
        expect($prop.$oneOfSelect.previousElementSibling?.tagName).toBe('UI-LABEL');
    });
});
