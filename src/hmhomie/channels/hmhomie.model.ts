import { CCUConnectionInfo } from "../../ccu/CCU";
import { CCUChannelTypes, Channel } from "../../ccu/homematic.model";
import { FactoryDevice } from "../FactoryDevice";

export type NodeCreator = (device: FactoryDevice, channels: Channel[], conn: CCUConnectionInfo) => void;

export type NodeCreatorMap = {
    [ChannelType in CCUChannelTypes]?: NodeCreator
}
