import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import isFunction from 'lodash/isFunction';
import get from 'lodash/get';
import type jquery from 'jquery';

export interface JqEventListenerObject {
    data: any | undefined;
    guid: number;
    handler: Function;
    namespace: string;
    needsContext: any | undefined;
    origType: string;
    selector: any | undefined;
    type: string,
}

export type JqEventListenersDataType = Record<string, JqEventListenerObject[]>;

export function getEventListenersFromJqNode(node: ReturnType<typeof $>): JqEventListenersDataType {
    // @ts-ignore
    return $._data(node[0], "events");
}

export interface LinkTypeData {
    count: number;
    external: boolean;
    isLink: boolean;
    link: string;
    setFn: any | undefined;
    text: string;
}

export function isLinkTypeData(o: any): o is LinkTypeData {
    return isObject(o) && isString(get(o, 'link')) && isString(get(o, 'text'));
}

const logger = window.modUtils.getLogger();

export function patchMacro(
    macroKey: string,
    MacroRef: typeof Macro,
    ScriptingRef: typeof Scripting,
) {
    const link = MacroRef.get(macroKey);

    if (!link) {
        console.error(`[DoLLinkButtonFilter] patchMacro() cannot find macro [${macroKey}]`);
        logger.error(`[DoLLinkButtonFilter] patchMacro() cannot find macro [${macroKey}]`);
        return;
    }
    const h: Function = link.handler;
    if (!h && !isFunction(h)) {
        console.error(`[DoLLinkButtonFilter] patchMacro() cannot find macro [${macroKey}] handle`, [macroKey, link, h]);
        logger.error(`[DoLLinkButtonFilter] patchMacro() cannot find macro [${macroKey}] handle`);
        return;
    }


    MacroRef.delete(macroKey);
    MacroRef.add(macroKey, {
        isAsync: true,
        tags: null,

        handler() {
            const thisPtr = this;
            // console.log('[DoLLinkButtonFilter] patchLinkButton handler', [thisPtr, thisPtr.name, thisPtr.args, thisPtr.payload]);

            const r = h.apply(this as any, arguments);

            let needHookIndex = 0;
            let needHook = false;
            if (
                typeof thisPtr.args[0] === 'object' &&
                typeof thisPtr.args[1] === 'object' &&
                thisPtr.args.length === 2
            ) {
                needHookIndex = 1;
                needHook = true;
            } else if (
                typeof thisPtr.args[2] === 'object' &&
                thisPtr.args.length === 3
            ) {
                needHookIndex = 2;
                needHook = true;
            } else if (
                typeof thisPtr.args[thisPtr.args.length - 1] === 'object' &&
                thisPtr.args.length > 3
            ) {
                needHookIndex = thisPtr.args.length - 1;
                needHook = true;
                console.log('[DoLLinkButtonFilter] patchMacro() find needHook but not usually, maybe game updated OR bad code ?', [thisPtr, thisPtr.name, thisPtr.args]);
                logger.warn('[DoLLinkButtonFilter] patchMacro() find needHook but not usually, maybe game updated OR bad code ?');
            } else {
                needHook = false;
            }
            // console.log('[DoLLinkButtonFilter] patchLinkButton handler', [thisPtr, thisPtr.name, thisPtr.args, thisPtr.payload, needHook, needHookIndex]);

            if (needHook) {

                const hookData = thisPtr.args[needHookIndex];
                if (!isLinkTypeData(hookData)) {
                    console.error('[DoLLinkButtonFilter] patchMacro() hookData invalid', [thisPtr, thisPtr.name, thisPtr.args, hookData]);
                    return r;
                }


                const outputRef = $(this.output);

                const children = outputRef.children();
                const node = children.last();

                const events = getEventListenersFromJqNode(node);

                const hookKeyList = ['keypress', 'click'];

                for (const key of hookKeyList) {
                    const eventList = events[key];
                    if (eventList) {
                        for (const event of eventList) {
                            const handler = event.handler;
                            event.handler = function () {
                                // console.log('[DoLLinkButtonFilter] patchLinkButton output jq events', [key, thisPtr, thisPtr.name, thisPtr.args, thisPtr.args[0], thisPtr.output, thisPtr.payload]);
                                const testR = ScriptingRef.evalTwineScript(hookData.text.trim());
                                if (testR) {
                                    // need filter
                                    // console.log('[DoLLinkButtonFilter] patchLinkButton filter event', [key, thisPtr, thisPtr.name, thisPtr.args, thisPtr.payload, hookData]);
                                    if (hookData.text.trim() !== hookData.link.trim()) {
                                        // console.log('[DoLLinkButtonFilter] patchMacro() run custom event', [key, thisPtr, thisPtr.name, thisPtr.args, thisPtr.payload, hookData]);
                                        ScriptingRef.evalTwineScript(hookData.link.trim());
                                    }
                                } else {
                                    // allow
                                    // console.log('[DoLLinkButtonFilter] patchLinkButton allow event', [key, thisPtr, thisPtr.name, thisPtr.args,]);
                                    handler.apply(this, arguments);
                                }
                            }
                        }
                    }
                }

            }

            return r;
        },
    });
}

export function patchLinkButton(
    MacroRef: typeof Macro,
    ScriptingRef: typeof Scripting,
) {
    patchMacro('link', MacroRef, ScriptingRef);
    patchMacro('button', MacroRef, ScriptingRef);

    console.log('[DoLLinkButtonFilter] patchLinkButton() success.');
    logger.log('[DoLLinkButtonFilter] patchLinkButton() success.');
}

window.DoLLinkButtonFilter_patchLinkButton = patchLinkButton;

