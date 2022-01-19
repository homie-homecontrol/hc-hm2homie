import { CCUConnectionInfo } from "../ccu/CCU";
import { CCUHMParamsetFlags, CCUHMParamsetOperations, Channel, Datapoint, Paramset } from "../ccu/homematic.model";
import { GenericHMDevice } from "./GenericHMDevice";
import * as winston from "winston";
import { takeUntil, tap } from "rxjs/operators";
import { HomieDeviceManager, HomieNode, OnSetEvent, HomieProperty } from "node-homie";
import { HomieDatatype, HOMIE_TYPE_BOOL, HOMIE_TYPE_FLOAT, HOMIE_TYPE_INT, HOMIE_TYPE_STRING } from "node-homie/model";
const log = winston.child({
    type: 'hmhomie-utils',
});


export function getChannelNumber(deviceAddr: string, channelNum: number, channels: Channel[]) {
    const channelAddr = `${deviceAddr}:${channelNum}`
    for (let index = 0; index < channels.length; index++) {
        const channel = channels[index];
        if (channel.definition.ADDRESS === channelAddr) {
            return channel;
        }
    }
    return null;
}

export function getChannelByType(type: string, channels: Channel[]) {
    for (let index = 0; index < channels.length; index++) {
        const channel = channels[index];
        if (channel.definition.TYPE === type) {
            return channel;
        }
    }
    return null;
}

export function isChannelAddr(deviceAddress: string): boolean {
    return deviceAddress.includes(':');
}

export function getDeviceFromAddr(dm: HomieDeviceManager, deviceAddress: string): GenericHMDevice {
    const deviceId = deviceAddress.split(':', 2)[0];
    return dm.devices[hmID2HomieID(deviceId)] as GenericHMDevice;
}

export function hmID2HomieID(id: string) {
    return id.toLowerCase().replace(':', '-');
}

export function homieID2hmID(id: string) {
    return id.toUpperCase().replace('-', ':');
}

export function hmType2homieType(datapoint: Datapoint): HomieDatatype {
    // debug('HM TYPE: ', datapoint.meta.TYPE);
    switch (datapoint.meta.TYPE.toLowerCase()) {
        case 'action':
        case 'bool':
            return HOMIE_TYPE_BOOL;
        case 'float':
            return HOMIE_TYPE_FLOAT;
        case 'integer':
            return HOMIE_TYPE_INT;
        case 'option':
        case 'enum':
            return HOMIE_TYPE_INT;
        case 'string':
            return HOMIE_TYPE_STRING;
        default:
            log.warn('No match for: %s', datapoint.meta.TYPE);
            return HOMIE_TYPE_STRING;
    }
}

export function homieValue2hmValue(datatype: string, value: any): any {
    let val: any = value;
    if (datatype === HOMIE_TYPE_BOOL) {
        val = value === 'true';
    } else if (datatype === HOMIE_TYPE_FLOAT || datatype === HOMIE_TYPE_INT) {
        val = Number(value);
    } else {
        val = value;
    }
    return val;
}

export function validParameter(nodeType: string, datapoint: Datapoint): boolean {
    log.debug(`validate: ${nodeType} - ${datapoint.id} / ${datapoint.meta.FLAGS}`);
    if (nodeType !== 'MAINTENANCE' || (nodeType === 'MAINTENANCE' && (datapoint.id === 'LOWBAT' || datapoint.id === 'UNREACH'))) {
        if ((datapoint.meta.FLAGS & CCUHMParamsetFlags.visible) == CCUHMParamsetFlags.visible && (!((datapoint.meta.FLAGS & CCUHMParamsetFlags.internal) == CCUHMParamsetFlags.internal))) {
            return true;
        } else {
            log.debug(`skip param ${nodeType}-${datapoint.id}`)
        }
    }
    return false;
}


export function checkIfNode(type: string, paramset: Paramset, validateCB = validParameter): boolean {
    for (const paramId in paramset) {
        if (Object.prototype.hasOwnProperty.call(paramset, paramId)) {
            const datapoint = paramset[paramId];
            if (validateCB(type, datapoint)) {
                return true;
            }
        }
    }

    return false;
}

export function datapointToProperty(node: HomieNode, datapoint: Datapoint, setHandler: (event: OnSetEvent) => void): HomieProperty {
    const prop = node.add(new HomieProperty(node, {
        id: hmID2HomieID(datapoint.id),
        name: datapoint.id, datatype: hmType2homieType(datapoint),
        settable: (datapoint.meta.OPERATIONS & CCUHMParamsetOperations.write) === CCUHMParamsetOperations.write,
        retained: datapoint.meta.TYPE !== 'ACTION',
        unit: datapoint.meta.UNIT?.replace('�', '°')
    }
    ));
    prop.value = datapoint.value != null ? String(datapoint.value) : null
    prop.onSetMessage$.pipe(
        takeUntil(prop.onDestroy$),
        tap(setHandler)
    ).subscribe(
        {
            error: (err) => {
                log.error(`Error process set Event for [${prop.pointer}].`, { error: err });
            }
        }
    );

    return prop;
}

export function makeSetHandler(node: HomieNode, address: string, conn: CCUConnectionInfo, paramsetKey: 'MASTER' | 'VALUES') {
    return (event: OnSetEvent) => {
        const val = event.value;

        log.verbose(`${event.property.pointer}: setting value to ${event.value} --> ${val} -- ${typeof val}`)
        conn.ccu.putParamset(conn.clientId, address, paramsetKey, { [homieID2hmID(event.property.id)]: val }).then(() => {
            event.property.value = event.valueStr;
        }).catch((err) => {
            log.error(`${event.property.pointer}: error setting value to ${val} -- ${typeof val}`, err)
        })
    };
}


export function paramsetToProperties(node: HomieNode, paramset: Paramset, setHandler: (event: OnSetEvent) => void, validateCB = validParameter): HomieNode {
    for (const datapointId in paramset) {
        if (Object.prototype.hasOwnProperty.call(paramset, datapointId)) {
            const datapoint = paramset[datapointId];
            if (validateCB(node.attributes.type, datapoint)) {

                const prop = datapointToProperty(node, datapoint, setHandler);
                log.debug(`PROPERTY: ${node.id}.${prop.id}`);
            }
        }
    }
    return node;
}


export function createNodeFromChannel(device: GenericHMDevice, channel: Channel) {
    log.debug(`NODE for: [${channel.definition.ADDRESS}]: ${channel.name}`);
    // printParamFlagsHEader(channel.definition.ADDRESS);
    if (checkIfNode(channel.definition.TYPE, channel.readings)) {
        const node = device.add(new HomieNode(device, { id: hmID2HomieID(channel.definition.ADDRESS), name: `${channel.name} - ${channel.definition.TYPE}`, type: channel.definition.TYPE }));
        node.meta.add({ id: 'hm-channel', key: 'smarthome.schaz.org/v1/channel-address', value: channel.definition.ADDRESS });
        paramsetToProperties(node, channel.readings, makeSetHandler(node, channel.definition.ADDRESS, device.conn, 'VALUES'));

        return node;
    } else {
        log.debug(`${channel.definition.ADDRESS} - no node created!`);
    }
    return undefined;
}