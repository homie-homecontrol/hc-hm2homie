
import { CCUConnectionInfo } from "../ccu/CCU";
import { Device, DeviceDescription } from "../ccu/homematic.model";
import { Core } from "../core/Core";
import { FactoryDevice } from "./FactoryDevice";
import { GenericHMDevice } from "./GenericHMDevice";
import { hmID2HomieID } from "./utils";
import * as winston from "winston";
import { HomieDeviceAtrributes } from "node-homie/model";
import { MQTTConnectOpts } from "node-homie/model";
import { HomieDevice } from "node-homie";

export declare type FactoryDeviceClass = {
    new(attrs: HomieDeviceAtrributes, mqttOptions: MQTTConnectOpts, conn: CCUConnectionInfo, device: Device): FactoryDevice;
};

export interface DeviceTypeClasses {
    [type: string]: FactoryDeviceClass
}

export class DeviceFactory {

    private deviceTypes: DeviceTypeClasses = {}
    private core: Core;
    protected readonly log: winston.Logger;

    constructor(core: Core) {
        this.core = core;
        this.log = winston.child({
            type: this.constructor.name
        });
    }

    public async createDevice(conn: CCUConnectionInfo, device: DeviceDescription | string): Promise<HomieDevice> {
        let hmDevice: Device = null;
        const address = typeof device === 'string' ? device as string : device.ADDRESS;
        try {

            hmDevice = await conn.ccu.getCCUDevice(conn.clientId, address);

        } catch (err) {
            this.log.error(`${conn.clientId} - ${address}: Failed to load CCUDeviceInfo!`, err);
            return Promise.reject(err);

        }

        const typeClass = this.deviceTypes[hmDevice.definition.TYPE] ? this.deviceTypes[hmDevice.definition.TYPE] : GenericHMDevice;

        const dev = new typeClass(
            {
                id: hmID2HomieID(hmDevice.definition.ADDRESS),
                name: hmDevice.name
            },
            {
                url: this.core.settings.mqtt_url,
                username: this.core.settings.mqtt_user,
                password: this.core.settings.mqtt_password,
                topicRoot: this.core.settings.mqtt_topic_root
            }, conn, hmDevice);

        await dev.create();
        return dev;


    }


}