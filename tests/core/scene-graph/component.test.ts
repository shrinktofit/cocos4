/// <reference types="jest" />

import { Component, director, Node, Scene } from '../../../exports/base';
import 'jest-extended';

class LifecycleObserver extends Component {
    override start = jest.fn();
    override update = jest.fn();
    override onLoad = jest.fn();
    override onDestroy = jest.fn();
    override onEnable = jest.fn();
    override onDisable = jest.fn();

    checkZero() {
        expect(this.start).not.toHaveBeenCalled();
        expect(this.update).not.toHaveBeenCalled();
        expect(this.onLoad).not.toHaveBeenCalled();
        expect(this.onDestroy).not.toHaveBeenCalled();
        expect(this.onEnable).not.toHaveBeenCalled();
        expect(this.onDisable).not.toHaveBeenCalled();
    }

    clearMocks() {
        this.start.mockClear();
        this.update.mockClear();
        this.onLoad.mockClear();
        this.onDestroy.mockClear();
        this.onEnable.mockClear();
        this.onDisable.mockClear();
    }
}

describe('life time hooks', () => {
    it('_', () => {
        const node = new Node();
        const component: LifecycleObserver = node.addComponent(LifecycleObserver);

        // Mount to a detached node, nothing should happen yet.
        component.checkZero();
    });

    describe('for whether the node is active, the new created component', () => {
        let node: Node = undefined!;
            beforeEach(() => {
            const scene = new Scene('');
            director.runSceneImmediate(scene);

            const root = new Node();
            scene.addChild(root);
            expect(root.activeInHierarchy).toBe(true);

            node = new Node();
            root.addChild(node);
        });

        it('should not be enabled if the node is inactive', () => {
            node.active = false;
            const component: LifecycleObserver = node.addComponent(LifecycleObserver);
            component.checkZero();
        });

        it('should be enabled if the node is active', () => {
            node.active = true;
            director.tick(0.1);
            const component: LifecycleObserver = node.addComponent(LifecycleObserver);
            expect(component.onLoad).toHaveBeenCalledTimes(1);
            expect(component.onEnable).toHaveBeenCalledTimes(1);
            expect(component.onLoad).toHaveBeenCalledBefore(component.onEnable);
            component.onLoad.mockClear();
            component.onEnable.mockClear();
            component.checkZero();
            director.tick(0.1);
            expect(component.start).toHaveBeenCalledTimes(1);
            expect(component.update).toHaveBeenCalledTimes(1);
            expect(component.start).toHaveBeenCalledBefore(component.update);
            component.start.mockClear();
            component.update.mockClear();
            component.checkZero();
        });
    });

    it('re-parent does not trigger lifecycle hooks', () => {
        const scene = new Scene('');
        director.runSceneImmediate(scene);

        const root = new Node();
        scene.addChild(root);
        expect(root.activeInHierarchy).toBe(true);

        const node1 = new Node();
        root.addChild(node1);
        const component1: LifecycleObserver = node1.addComponent(LifecycleObserver);
        const node2 = new Node();
        root.addChild(node2);

        component1.clearMocks();
        node1.parent = node2;
        component1.checkZero();
    });
});
