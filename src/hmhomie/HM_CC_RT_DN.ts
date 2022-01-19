import { HomieNode, HomieProperty } from "node-homie";
import { HomieDeviceAtrributes, HOMIE_TYPE_STRING } from "node-homie/model";
import { MQTTConnectOpts } from "node-homie/model";
import { CCUConnectionInfo } from "../ccu/CCU";
import { Device } from "../ccu/homematic.model";

import { GenericHMDevice } from "./GenericHMDevice";
import { createNodeFromChannel, makeSetHandler, paramsetToProperties, validParameter } from "./utils";


export class HM_CC_RT_DN extends GenericHMDevice {

    constructor(attrs: HomieDeviceAtrributes, mqttOptions: MQTTConnectOpts, conn: CCUConnectionInfo, device: Device) {
        super(attrs, mqttOptions, conn, device);

        this.tags.add('HM_CC_RT_DN-hm-device');
    }


    public async create() {
        if (this.created) { return Promise.resolve(); }

        // debug('Config node:', this.device.config);

        // Object.keys(this.device.config).forEach(dp => {
        //     debug(dp, '  --> ', this.device.config[dp].value);
        // });

        // const program = [];
        // for (let p = 1; p <= 3; p++) {
        const programEntry = {};

        ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].forEach(day => {
            const daySchedule = [];
            for (let slot = 1; slot <= 13; slot++) {
                daySchedule.push({
                    endtime: this.device.config[`ENDTIME_${day}_${slot}`].value,
                    temp: this.device.config[`TEMPERATURE_${day}_${slot}`].value,
                })
            }
            programEntry[day] = daySchedule;
        })
        // program.push(programEntry);

        // }
        // debug(`${this.deviceId} -- `,inspect(program, { showHidden: false, depth: null }));

        const configNode = this.add(new HomieNode(this, { id: 'config', name: 'Device configuration node', type: 'config' }));
        const week_program_prop = configNode.add(new HomieProperty(configNode, { id: 'WEEK_PROGRAM', name: 'Heating program', datatype: HOMIE_TYPE_STRING, settable: false, retained: true, unit: '', format: 'json' }));
        week_program_prop.value = JSON.stringify(programEntry);


        paramsetToProperties(configNode, this.device.config,
            makeSetHandler(configNode, this.device.definition.ADDRESS, this.conn, 'MASTER'),
            (nodeType, datapoint) => (validParameter(nodeType, datapoint) && !datapoint.id.startsWith('TEMPERATURE_') && !datapoint.id.startsWith('ENDTIME_'))
        )


        // Object.keys(this.device.config).forEach(paramId => {
        //     const datapoint = this.device.config[paramId];

        // })


        // if (this.checkIfNode('config',this.conn.clientId, this.device.definition.ADDRESS, 'MASTER', this.device.config)) {
        //     const configNode = this.addNode('config', 'Device configuration node', 'config');
        //     this.paramsetToProperties(configNode,
        //         this.conn.clientId,
        //         this.device.definition.ADDRESS,
        //         'MASTER',
        //         this.device.config
        //     );
        // }


        // this.attributes.implementation = this.device.definition.TYPE;


        this.device.channels.forEach(channel => {
            createNodeFromChannel(this, channel);
        });
        this.created = true;
    }


}