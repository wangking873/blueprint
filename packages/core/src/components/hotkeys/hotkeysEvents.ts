/*
 * Copyright 2016 Palantir Technologies, Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 - http://www.apache.org/licenses/LICENSE-2.0
 */

import { safeInvoke } from "../../common/utils";
import { Children, ReactElement, ReactNode } from "react";

import { Hotkey, IHotkeyProps } from "./hotkey";
import { IKeyCombo, comboMatches, getKeyCombo, keyComboToString, parseKeyCombo } from "./hotkeyParser";
import { IHotkeysProps } from "./hotkeys";
import { isHotkeysDialogShowing, showHotkeysDialog } from "./hotkeysDialog";

const SHOW_DIALOG_KEY_COMBO = parseKeyCombo("?");

export enum HotkeyScope {
    LOCAL,
    GLOBAL,
}

export interface IHotkeyAction {
    combo: IKeyCombo;
    props: IHotkeyProps;
}

export interface IHotkeysSeenEventExtension {
    hotkeysSeen: {
        [key: string]: boolean;
    };
}

export class HotkeysEvents {
    private actions = [] as IHotkeyAction[];

    public constructor(private scope: HotkeyScope) {
    }

    public count() {
        return this.actions.length;
    }

    public clear() {
        this.actions = [];
    }

    public setHotkeys(props: IHotkeysProps & { children: ReactNode[] }) {
        const actions = [] as IHotkeyAction[];
        Children.forEach(props.children, (child: ReactElement<any>) => {
            if (Hotkey.isInstance(child) && this.isScope(child.props)) {
                actions.push({
                    combo: parseKeyCombo(child.props.combo),
                    props: child.props,
                });
            }
        });
        this.actions = actions;
    }

    public handleKeyDown = (e: KeyboardEvent & IHotkeysSeenEventExtension) => {
        if (e.hotkeysSeen == null) {
            e.hotkeysSeen = {};
        }

        if (this.isTextInput(e) || isHotkeysDialogShowing()) {
            return;
        }

        const combo = getKeyCombo(e);

        if (comboMatches(SHOW_DIALOG_KEY_COMBO, combo)) {
            showHotkeysDialog(this.actions.map((action) => action.props));
            return;
        }

        for (const action of this.actions) {
            const comboString = keyComboToString(action.combo);
            const hasSeenHotkey = e.hotkeysSeen[comboString];

            if (comboMatches(action.combo, combo) && !hasSeenHotkey) {
                safeInvoke(action.props.onKeyDown, e);
            }
        }

        // notify parent scopes that a hotkey callback was already triggered at this level
        const comboString = keyComboToString(combo);
        e.hotkeysSeen[comboString] = true;
    }

    public handleKeyUp = (e: KeyboardEvent & IHotkeysSeenEventExtension) => {
        if (this.isTextInput(e) || isHotkeysDialogShowing()) {
            return;
        }

        if (e.hotkeysSeen == null) {
            e.hotkeysSeen = {};
        }

        const combo = getKeyCombo(e);

        for (const action of this.actions) {
            const comboString = keyComboToString(action.combo);
            const hasSeenHotkey = e.hotkeysSeen[comboString];

            if (comboMatches(action.combo, combo) && !hasSeenHotkey) {
                safeInvoke(action.props.onKeyUp, e);
            }
        }

        // notify parent scopes that a hotkey callback was already triggered at this level
        const comboString = keyComboToString(combo);
        e.hotkeysSeen[comboString] = true;
    }

    private isScope(props: IHotkeyProps) {
        return (props.global ? HotkeyScope.GLOBAL : HotkeyScope.LOCAL) === this.scope;
    }

    private isTextInput(e: KeyboardEvent) {
        const elem = e.target as HTMLElement;
        // we check these cases for unit testing, but this should not happen
        // during normal operation
        if (elem == null || elem.closest == null) {
            return false;
        }

        const editable = elem.closest("input, textarea, [contenteditable=true]");

        if (editable == null) {
            return false;
        }

        // don't let checkboxes, switches, and radio buttons prevent hotkey behavior
        if (editable.tagName.toLowerCase() === "input") {
            const inputType = (editable as HTMLInputElement).type;
            if (inputType === "checkbox" || inputType === "radio") {
                return false;
            }
        }

        // don't let read-only fields prevent hotkey behavior
        if ((editable as HTMLInputElement).readOnly) {
            return false;
        }

        return true;
    }
}
