
import { HomieDeviceAtrributes } from "node-homie/model";
import { HomieNode } from "node-homie";
import { MQTTConnectOpts } from "node-homie/model";
import { CCUConnectionInfo } from "../ccu/CCU";
import { CCUDeviceMessage, Device } from "../ccu/homematic.model";

import { FactoryDevice } from "./FactoryDevice";
import { createNodeFromChannel, hmID2HomieID, isChannelAddr } from "./utils";
import { createNodesForDevice } from "./channels";
import { H_SMARTHOME_NS_V1 } from "hc-node-homie-smarthome/model";
import { createCfgNodesForDevice } from "./config";


export class GenericHMDevice extends FactoryDevice {

    protected created = false;

    protected specificNodeCreated = false;

    constructor(attrs: HomieDeviceAtrributes, mqttOptions: MQTTConnectOpts, public readonly conn: CCUConnectionInfo, public readonly device: Device) {
        super({ ...attrs, implementation: 'smarthome.schaz.org/v1' }, mqttOptions);
        this.device = device;
        this.conn = conn;

        const controllerMeta = this.meta.add({
            id: 'hc-controller', key: `${H_SMARTHOME_NS_V1}/controller`, value: 'hm2homie', subkeys: [
                { id: 'hm-device-type', key: `${H_SMARTHOME_NS_V1}/hm-device-type`, value: device.definition.TYPE },
                { id: 'hm-device-fw', key: `${H_SMARTHOME_NS_V1}/hm-device-fw`, value: device.definition.FIRMWARE },
                { id: 'hm-protocol', key: `${H_SMARTHOME_NS_V1}/hm-protocol`, value: conn.protocol }
            ]
        })

    }

    public async create() {
        if (this.created) { return Promise.resolve(); }

        // create special config nodes to handle HomeMatic specific settings for a device
        createCfgNodesForDevice(this, this.device, this.conn);

        // create node-homie-smartphone specific nodes to expose the hm devices functionality as generic as possible
        this.specificNodeCreated = createNodesForDevice(this, this.device, this.conn);

        if (!this.specificNodeCreated) {
            this.log.info(`no specific smarthome nodes created for ${this.device.name}|${this.device.definition.ADDRESS}. Will generate generic ones.`)
            this.device.channels.forEach(channel => {
                createNodeFromChannel(this, channel);
            });
        }
        this.created = true;
    }

    public handleEventMessage(message: CCUDeviceMessage) {
        this.eventMessage(message);
        if (!this.specificNodeCreated) {
            let node: HomieNode = null;
            if (isChannelAddr(message.deviceAddress)) {
                node = this.get(hmID2HomieID(message.deviceAddress));
            } else {
                node = this.get('config');
            }
            if (!!node) {
                const property = node.get(message.datapoint);
                if (!!property) {
                    property.value = String(message.value);
                }
            }
        }
    }


}