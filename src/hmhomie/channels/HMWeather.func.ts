import { WeatherNode } from "hc-node-homie-smarthome";
import { takeUntil } from "rxjs/operators";
import { CCUConnectionInfo, Channel } from "../../ccu";
import { FactoryDevice } from "../FactoryDevice";
import { log } from "./logging";
import { getIndexFromChannelAddress } from "../../ccu";


export function HMWeatherToNode(device: FactoryDevice, channels: Channel[], conn: CCUConnectionInfo) {
    if (channels.length === 1) {
        createWeatherNode(device, channels[0], conn);
    } else {
        channels.forEach(channel => {
            const channelIndex = getIndexFromChannelAddress(channel.definition.ADDRESS);
            createWeatherNode(device, channel, conn, `weather-${channelIndex}`, `Weather ${channelIndex}`);
        })
    }

}

function createWeatherNode(device: FactoryDevice, channel: Channel, conn: CCUConnectionInfo, id?: string, name?: string,) {

    const node = device.add(new WeatherNode(device, id ? { id, name } : undefined));
    const weatherChannel_Param_Temperature = 'TEMPERATURE';
    const weatherChannel_Param_Humidity = 'HUMIDITY';

    // Set current state
    node.temperature = channel.readings[weatherChannel_Param_Temperature]?.value;
    node.humidity = channel.readings[weatherChannel_Param_Humidity]?.value;

    // homie -> hm eventstream
    // none - sensor only

    // hm -> homie eventstream
    device.events$.pipe(takeUntil(node.onDestroy$)).subscribe(
        {
            next: message => {
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === weatherChannel_Param_Temperature) {
                    node.temperature=message.value;
                }
        
                if (message.deviceAddress === channel.definition.ADDRESS && message.datapoint === weatherChannel_Param_Humidity) {
                    node.humidity=message.value;
                }
            },
            error: (err) => {
                log.error(`Error process hm message for [${node.pointer}]/[${channel.definition.ADDRESS}].`, { error: err });
            }
        }
    )


}