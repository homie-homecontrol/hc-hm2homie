import { CCUConnectionInfo } from "../../ccu/CCU";
import { Device } from "../../ccu/homematic.model";
import { FactoryDevice } from "../FactoryDevice";

export type ConfigNodeCreator = (device: FactoryDevice, hmDevice: Device, conn: CCUConnectionInfo) => void;
export type ConfigNodeCreatorMap = {
    [deviceType: string]: ConfigNodeCreator
}
