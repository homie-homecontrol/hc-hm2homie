
export const CCU_PROTO_REGA = 'rega';
export const CCU_PROTO_BIDCOS_WIRED = 'bidcos-wired';
export const CCU_PROTO_BIDCOS_RF = 'bidcos-rf';
export const CCU_PROTO_HMIP_RF = 'hmip-rf';
export const CCU_PROTO_VIRT = 'virt';
export const CCU_PROTO_CUXD = 'cuxd';

export const CCU_PROTOCOLS = [CCU_PROTO_REGA, CCU_PROTO_BIDCOS_WIRED, CCU_PROTO_BIDCOS_RF, CCU_PROTO_HMIP_RF, CCU_PROTO_VIRT, CCU_PROTO_CUXD] as const;

export type CCUProtocols = typeof CCU_PROTOCOLS[number];

export type CCUProtoPortMapping = {
    [index in CCUProtocols]: number;
}

export const CCU_PROTO_PORTS: CCUProtoPortMapping = {
    [CCU_PROTO_REGA]: 1999,
    [CCU_PROTO_BIDCOS_WIRED]: 2000,
    [CCU_PROTO_BIDCOS_RF]: 2001,
    [CCU_PROTO_HMIP_RF]: 2010,
    [CCU_PROTO_VIRT]: 9292,
    [CCU_PROTO_CUXD]: 8701
}

export function isCCUProtocol(proto: any): proto is CCUProtocols {
    return proto !== null && proto !== undefined && CCU_PROTOCOLS.includes(proto);
}



export interface CCUDeviceMessage {
    deviceName: string;
    deviceAddress: string;
    datapoint: string;
    value: any;

}


export enum CCUHMParamsetOperations {
    read = 0x01,
    write = 0x02,
    event = 0x04
}

export enum CCUHMParamsetFlags {
    visible = 0x01,
    internal = 0x02,
    transform = 0x04,
    service = 0x08,
    sticky = 0x10
}

export interface SpecialDescription {
    ID: string;
    value: number;
}

export interface ParameterDescription {
    TYPE: string,
    OPERATIONS: CCUHMParamsetOperations,
    FLAGS: CCUHMParamsetFlags,
    DEFAULT: any,
    MAX: any,
    MIN: any,
    UNIT: string,
    TAB_ORDER: number,
    CONTROL: string,
    SPECIAL?: SpecialDescription[];
    VALUE_LIST?: string[]
}

export interface Datapoint {
    id: string,
    value: any,
    meta: ParameterDescription
}

export interface Paramset {
    [id: string]: Datapoint
}

export interface ParamsetDescription {
    [id: string]: any
}

export interface DeviceDescription {
    TYPE: string;
    ADDRESS: string;
    RF_ADDRESS?: number;
    CHILDREN: string[];
    PARENT: string;
    PARENT_TYPE: string;
    INDEX: number;
    AES_ACTIVE: number;
    PARAMSETS: string[];
    FIRMWARE?: string;
    AVAILABLE_FIRMWARE?: string;
    UPDATEABLE: number;
    VERSION: number;
    FLAGS: number;
    LINK_SOURCE_ROLES?: string;
    LINK_TARGET_ROLES?: string;
    DIRECTION?: number;
    GROUP?: string;
    TEAM?: string;
    TEAM_TAG?: string;
    TEAM_CHANNELS?: string;
    INTERFACE?: string;
    ROAMING: number;
    RX_MODE: number;
}


export interface Channel {
    name: string;
    definition: DeviceDescription;
    config: Paramset;   // MASTER Paramset
    readings: Paramset; // VALUES Paramset
}


export interface Device {
    name: string;
    definition: DeviceDescription;
    config: Paramset;
    channels: Channel[];
}




export const CCU_PARAMSET_OPERATIONS_READ = 0x01;
export const CCU_PARAMSET_OPERATIONS_WRITE = 0x02;
export const CCU_PARAMSET_OPERATIONS_EVENT = 0x04;

export const CCU_PARAMSET_FLAGS_VISIBLE = 0x01;
export const CCU_PARAMSET_FLAGS_INTERNAL = 0x02;
export const CCU_PARAMSET_FLAGS_TRANSFORM = 0x04;
export const CCU_PARAMSET_FLAGS_SERVICE = 0x08;
export const CCU_PARAMSET_FLAGS_STICKY = 0x10;



export function isIterable(object) {
    // eslint-disable-next-line eqeqeq, no-eq-null
    return object != null && typeof object[Symbol.iterator] === 'function' && typeof object.forEach === 'function';
}


export const CCU_CH_TYPE_MAINTENANCE = 'MAINTENANCE';
export const CCU_CH_TYPE_SWITCH = 'SWITCH';   // --> SwitchNode
export const CCU_CH_TYPE_WEATHER = 'WEATHER'; // --> WeatherNode
export const CCU_CH_TYPE_TILT_SENSOR = 'TILT_SENSOR'; // -->TiltSensorNode
export const CCU_CH_TYPE_SHUTTER_CONTACT = 'SHUTTER_CONTACT'; // --> Contact
export const CCU_CH_TYPE_KEY = 'KEY';  // ButtonNode
export const CCU_CH_TYPE_VIRTUAL_KEY = 'VIRTUAL_KEY';
export const CCU_CH_TYPE_MOTION_DETECTOR = 'MOTION_DETECTOR'; // -> MotionSensorNode
export const CCU_CH_TYPE_BLIND = 'BLIND'; // ->ShutterNode
export const CCU_CH_TYPE_WEATHER_TRANSMIT = 'WEATHER_TRANSMIT';   // -->weatherNode
export const CCU_CH_TYPE_THERMALCONTROL_TRANSMIT = 'THERMALCONTROL_TRANSMIT'; // -->ThermostatNode
export const CCU_CH_TYPE_CLIMATECONTROL_RT_TRANSCEIVER = 'CLIMATECONTROL_RT_TRANSCEIVER'; // -->ThermostatNode
export const CCU_CH_TYPE_POWERMETER = 'POWERMETER';
export const CCU_CH_TYPE_CONDITION_POWER = 'CONDITION_POWER';
export const CCU_CH_TYPE_CONDITION_CURRENT = 'CONDITION_CURRENT';
export const CCU_CH_TYPE_CONDITION_VOLTAGE = 'CONDITION_VOLTAGE';
export const CCU_CH_TYPE_CONDITION_FREQUENCY = 'CONDITION_FREQUENCY';



export const CCU_CH_TYPES = [
    CCU_CH_TYPE_MAINTENANCE,
    CCU_CH_TYPE_SWITCH,
    CCU_CH_TYPE_WEATHER,
    CCU_CH_TYPE_TILT_SENSOR,
    CCU_CH_TYPE_SHUTTER_CONTACT,
    CCU_CH_TYPE_KEY,
    CCU_CH_TYPE_VIRTUAL_KEY,
    CCU_CH_TYPE_MOTION_DETECTOR,
    CCU_CH_TYPE_BLIND,
    CCU_CH_TYPE_WEATHER_TRANSMIT,
    CCU_CH_TYPE_THERMALCONTROL_TRANSMIT,
    CCU_CH_TYPE_CLIMATECONTROL_RT_TRANSCEIVER,
    CCU_CH_TYPE_POWERMETER,
    CCU_CH_TYPE_CONDITION_POWER,
    CCU_CH_TYPE_CONDITION_CURRENT,
    CCU_CH_TYPE_CONDITION_VOLTAGE,
    CCU_CH_TYPE_CONDITION_FREQUENCY,
] as const;
export type CCUChannelTypes = typeof CCU_CH_TYPES[number];


export const CCU_DEV_WEEKDAYS = [
    'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
] as const;

export type CCUDevWeekdays = typeof CCU_DEV_WEEKDAYS[number];