import { HomieID, isHomieID, MQTTConnectOpts } from 'node-homie/model';
import { Globals } from '../globals';

function getEnvVar(name: string): string | undefined {
    return process.env[`${Globals.SERVICE_NAMESPACE}_${name}`];
}

function stringENVVal(name: string, defval: string): string {
    return getEnvVar(name) || defval;
}

function homieIDENVVal(name: string, defval: HomieID): string {
    const val = getEnvVar(name) || defval;
    if (!isHomieID(val)) {
        throw new Error(`[${val}] is not a valid homie-id`);
    }
    return val;
}

function csvENVVal(name: string, defval: string[]): string[] {
    const val = getEnvVar(name);
    if (val) {
        return val.split(',');
    }
    return defval;
}

function boolENVVal(name: string, defval: boolean): boolean {
    const val = getEnvVar(name);
    if (!val) { return defval; }

    if (val.toLowerCase() === 'true' || val === '1') {
        return true;
    } else if (val.toLowerCase() === 'false' || val === '0') {
        return false;
    } else {
        return defval;
    }

}

function numberENVVal(name: string, defval: number): number {
    const val = getEnvVar(name) || defval;
    const _number: number = (typeof val === 'string') ? parseInt(val, 10) : val;
    return isNaN(_number) ? defval : _number;
}

export class Settings {
    mqttOpts: MQTTConnectOpts;

    constructor(
        public readonly controller_id               = homieIDENVVal(`CTRL_ID`, 'hc-hm2homie-1'),
        public readonly controller_name             = stringENVVal(`CTRL_NAME`, 'homematic ccu3 to homie interface controller'),

        public readonly ccu_host =                 stringENVVal(`CCU_HOST`, 'localhost'),
        public readonly ccu_interfaces =           csvENVVal(`CCU_INTERFACES`, ['bidcos-rf']),
        public readonly ccu_callback_bind_host =   stringENVVal(`CCU_CALLBACK_BIND_HOST`, '0.0.0.0'),
        public readonly ccu_callback_host =        stringENVVal(`CCU_CALLBACK_HOST`, ''),
        public readonly ccu_callback_port =        numberENVVal(`CCU_CALLBACK_PORT`, 9125),
        public readonly ccu_callback_id =          stringENVVal(`CCU_CALLBACK_ID`, 'HCHM2H'),
        public readonly mqtt_url =                 stringENVVal(`MQTT_URL`, ''),
        public readonly mqtt_user =                stringENVVal(`MQTT_USERNAME`, ''),
        public readonly mqtt_password =            stringENVVal(`MQTT_PASSWORD`, ''),
        public readonly mqtt_topic_root =          stringENVVal(`MQTT_TOPIC_ROOT`, 'homie'),
    ){
        this.mqttOpts = {
            url: this.mqtt_url,
            username: this.mqtt_user,
            password: this.mqtt_password,
            topicRoot: this.mqtt_topic_root
        }

    }

}
