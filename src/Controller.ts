import { CCU, CCUConnectionInfo, CCU_EVENT_ON_DEVICE_MESSAGE, isChannel } from "./ccu/CCU";
import { CCUDeviceMessage, DeviceDescription } from "./ccu/homematic.model";
import { Core } from "./core/Core";
import { DeviceFactory } from "./hmhomie/DeviceFactory";
import { getDeviceFromAddr, hmID2HomieID } from "./hmhomie/utils";
import {  HomieDeviceManager } from "node-homie";
import { Subject } from "rxjs";
import { HomieControllerBase } from 'node-homie/controller';


export class Controller extends HomieControllerBase {
    private stopping = false;
    private core: Core;
    public ccu: CCU;
    private factory: DeviceFactory;

    private dm = new HomieDeviceManager();

    private _events$ = new Subject<CCUDeviceMessage>();
    public events$ = this._events$.asObservable();

    constructor(core: Core) {
        super(core.settings.controller_id, core.settings.controller_name, core.settings.mqttOpts);
        this.core = core;
        this.ccu = new CCU(this.core);
        this.factory = new DeviceFactory(this.core);
    }

    async onInit(): Promise<void> {
        await super.onInit();

        this.ccu.on('newdevices', async (conn, devices) => {
            let newDeviceCount = 0;

            const newDevices = devices.filter(dev => !isChannel(dev));
            while (newDevices.length > 0) { // create new devices in batches of 10 as to not overload the CCU with requests...
                this.log.verbose(`Remaining devices to create: ${newDevices.length}`);
                const slice = newDevices.splice(0, 10);
                await Promise.all(slice.map(async device => {
                    newDeviceCount++
                    return this.createDevice(conn, device);
                })).catch(err => {
                    this.log.error(`Error creating devices`, err);
                });

                this.log.verbose(`Created ${slice.length} devices`);
            }
            this.log.info(`Finished device creaton: ${newDeviceCount}`);
        });

        this.ccu.on('deletedevice', (conn, deviceAddrs) => {
            deviceAddrs.forEach((deviceAddr) => {
                const homieID = hmID2HomieID(deviceAddr);
                const device = this.dm.devices[homieID];
                if (!device) { return; }
                this.dm.removeDevice(homieID)?.onDestroy().then(() => {
                    this.log.info(`Device [${device.id}] closed and removed.`)
                }).catch(() => {
                    this.log.verbose(`Error removing Device [${device.id}]`);
                })
            })
        })

        this.ccu.on('disconnect', () => {

            Object.keys(this.dm.devices).forEach(deviceId => {
                const device = this.dm.devices[deviceId];
                device.updateState$('disconnected').subscribe();
            });

        });

        this.ccu.on('reconnect', () => {

            Object.keys(this.dm.devices).forEach(deviceId => {
                const device = this.dm.devices[deviceId];
                device.updateState$('ready').subscribe();
            });

        });

        await this.ccu.onInit();


        this.connectEventListener();

        await this.controllerDevice.onInit();

        this.log.verbose('Devices initialization completed!');
    }

    private async createDevice(conn: CCUConnectionInfo, device: DeviceDescription) {
        if (this.stopping) { return; }
        try {
            const dev = await this.factory.createDevice(conn, device)
            if (!dev) { return; }
            if (this.dm.hasDevice(dev.id)) {
                const oldDevice = this.dm.removeDevice(dev.id);
                await oldDevice.onDestroy();
            }
            this.dm.add(dev);

            if (this.stopping) { return; }

            return dev.onInit();

        } catch (err) {
            this.log.error(`Error creating device: ${device.ADDRESS}`, err);
            return Promise.resolve();
        }
    }


    private connectEventListener() {
        if (this.stopping) { return; }
        this.ccu.on(CCU_EVENT_ON_DEVICE_MESSAGE, (conn: CCUConnectionInfo, message: CCUDeviceMessage) => {
            this.log.debug(`CCU event ${message.deviceAddress}(${message.deviceName}).${message.datapoint}=${message.value}`);

            const device = getDeviceFromAddr(this.dm, message.deviceAddress);
            device?.handleEventMessage(message);

        });
    }




    async onDestroy(): Promise<void> {
        await super.onDestroy();
        this.stopping = true;
        await this.dm.onDestroy();
        await this.ccu.onDestroy();
        await this.controllerDevice.onDestroy();
        this.log.info('All devices were closed. Ready for shutdown...');

    }
}