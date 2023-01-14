import { Core } from "../core/Core";

// const rpc = require('binrpc');
import * as rpc from 'homematic-xmlrpc';
import Rega from 'homematic-rega';
const hmDiscover = require('hm-discover');
import { EventEmitter } from "events";
import { ParamsetDescription, CCUDeviceMessage, Paramset, Datapoint, Device, Channel, isIterable, DeviceDescription, CCU_PROTO_BIDCOS_RF, CCU_PROTO_PORTS, CCU_PROTO_HMIP_RF, isCCUProtocol } from "./homematic.model";


import * as winston from "winston";
import { OnDestroy, OnInit } from "node-homie/misc";
import { CCU_PROTOCOLS } from ".";
import { inspect } from "util";

export interface CCUConnectionInfo {
    clientId: string;
    protocol: string;
    lastEvent: number;
    ccu: CCU;
}


export interface NameMapping {
    id: number;
    address: string;
    name: string;
}

export interface NameMappings {
    [index: string]: NameMapping
}

export interface CCUConnection {
    protocol: string,
    ifaceConfig: IfaceConfig,
    clientId: string,
    client: rpc.Client,
    timedOut: boolean,
    pingTimerRef?: NodeJS.Timeout,
    lastEvent?: number,
    connected?: boolean,
    reconnectTimer?: NodeJS.Timeout
}

export interface CCUConnections {
    [protocol: string]: CCUConnection
}

export interface IfaceConfig {
    name: string;
    rpc: any;
    port: number;
    protocol: 'binrpc' | 'xmlrpc' | 'xmlrpc_bin' | 'http';
    auth: boolean;
    username: string;
    password: string;
    tls: boolean;
    inSecure: boolean;
    init: boolean;
    ping: boolean;
    pingTimeout?: number;
}

export interface IfaceConfigs {
    [protocol: string]: IfaceConfig;
}


export const CCU_EVENT_ON_CONNECT = 'connect';
export const CCU_EVENT_ON_DISCONNECT = 'disconnect';
export const CCU_EVENT_ON_RECONNECT = 'reconnect';
export const CCU_EVENT_ON_DEVICE_MESSAGE = 'message';

export const CCU_EVENT_ON_NEW_DEVICES = 'newdevices';
export const CCU_EVENT_ON_UPDATE_DEVICE = 'updatedevice';
export const CCU_EVENT_ON_REPLACE_DEVICE = 'replacedevice';
export const CCU_EVENT_ON_READD_DEVICE = 'readdevice';
export const CCU_EVENT_ON_DELETE_DEVICE = 'deletedevice';

export declare interface CCU {
    on(event: 'connect', setCallback: (conn: CCUConnectionInfo) => void): this;
    on(event: 'disconnect', setCallback: (conn: CCUConnectionInfo) => void): this;
    on(event: 'reconnect', setCallback: (conn: CCUConnectionInfo) => void): this;
    on(event: 'message', setCallback: (conn: CCUConnectionInfo, message: CCUDeviceMessage) => void): this;

    on(event: 'newdevices', setCallback: (conn: CCUConnectionInfo, devices: DeviceDescription[]) => void): this;
    on(event: 'updatedevice', setCallback: (conn: CCUConnectionInfo, deviceAddr: string, hint: 0 | 1) => void): this;
    on(event: 'replacedevice', setCallback: (conn: CCUConnectionInfo, oldDeviceAddr: string, newDeviceAddr: string) => void): this;
    on(event: 'readdevice', setCallback: (conn: CCUConnectionInfo, deviceAddrs: string[]) => void): this;
    on(event: 'deletedevice', setCallback: (conn: CCUConnectionInfo, deviceAddrs: string[]) => void): this;


}

export function isChannel(device: DeviceDescription): boolean {
    return device?.PARENT !== '' && (!!device?.INDEX || device?.INDEX === 0);
}

export function isDevice(device: DeviceDescription): boolean {
    return device?.PARENT === '';
}


export class CCU extends EventEmitter implements OnInit, OnDestroy {
    protected readonly log: winston.Logger;

    connections: CCUConnections = {}
    ifaceConfigs: IfaceConfigs = {};

    server: rpc.Server;

    core: Core;
    rega: Rega;


    channelNameMappings: NameMappings = {}
    devices: DeviceDescription[] = [];

    constructor(core: Core) {
        super();
        this.core = core;
        this.log = winston.child({
            type: this.constructor.name,
        });

        this.core.settings.ccu_interfaces.forEach(interf => {
            if (!isCCUProtocol(interf)) {
                throw new Error(`[${interf}] is not a valid interface protocol. Must be one of [${CCU_PROTOCOLS.join(", ")}].`);
            }
        })


        this.ifaceConfigs = {
            [CCU_PROTO_BIDCOS_RF]: {
                name: CCU_PROTO_BIDCOS_RF,
                rpc: rpc,
                port: CCU_PROTO_PORTS[CCU_PROTO_BIDCOS_RF], // no tls ports implemented yet
                protocol: 'http',
                auth: false, // not implemented yet
                username: null, // not implemented yet
                password: null, // not implemented yet
                tls: false, // not implemented yet
                inSecure: true,
                init: true,
                ping: true
            },
            [CCU_PROTO_HMIP_RF]: {
                name: CCU_PROTO_HMIP_RF,
                rpc: rpc,
                port: CCU_PROTO_PORTS[CCU_PROTO_HMIP_RF], // no tls ports implemented yet
                protocol: 'http',
                auth: false, // not implemented yet
                username: null, // not implemented yet
                password: null, // not implemented yet
                tls: false, // not implemented yet
                inSecure: true,
                init: true,
                ping: true,
                pingTimeout: 600
            },

        }
        this.rega = new Rega({ host: core.settings.ccu_host })
    }

    public async onInit() {
        await this.updateNameMappings();
        let server_port = this.core.settings.ccu_callback_port;
        this.server = await this.createServer(this.core.settings.ccu_callback_bind_host, server_port);

        this.core.settings.ccu_interfaces.forEach(async (protocol) => {
            if (protocol in CCU_PROTO_PORTS) {
                const client_port = CCU_PROTO_PORTS[protocol];

                // const server =
                const connection: CCUConnection = {
                    protocol: protocol,
                    ifaceConfig: this.ifaceConfigs[protocol],
                    client: this.createClient(this.core.settings.ccu_host, client_port),
                    clientId: `${this.core.settings.ccu_callback_id}_${protocol}`,
                    lastEvent: Date.now(),
                    timedOut: false,
                    connected: false,
                    pingTimerRef: null
                };
                this.connections[connection.clientId] = connection;
                try {
                    await this.initConnection(connection)
                } catch (err) {
                    this.log.error("Error subscribing: ", err)
                }

            }
        });


    }

    public async updateNameMappings(): Promise<void> {
        return this.getNameMappings().then(mappings => {
            this.channelNameMappings = mappings
        });
    }



    private createClient(host: string, port: number): rpc.Client {
        const clientOpts = {
            host: host,
            port: port,
            path: '/'
        }
        this.log.info(`Client connecting to : ${clientOpts.host}:${clientOpts.port}`);
        return rpc.createClient(clientOpts);
    }

    private async createServer(host: string, port: number): Promise<rpc.Server> {
        return new Promise<rpc.Server>((resolve, reject) => {
            const serverOpts = {
                host: host,
                port: port
            }
            const server = rpc.createServer(serverOpts, () => {
                this.log.info(`Server listening on: ${serverOpts.host}:${serverOpts.port}`);
                this.setupServerEvents(server)
                resolve(server);
            });

        });
    }

    private setupServerEvents(server: rpc.Server) {
        const handlers = {
            'system.listMethods': (err, parameters, callback) => {
                const [clientId] = parameters;
                const conn = this.connections[clientId]
                this.log.debug(`${conn.clientId} - listMethods for local server: %s`, Object.keys(handlers))
                callback(null, Object.keys(handlers));
            },
            listDevices: (err, parameters, callback) => {
                this.log.debug('ListDevices for local server...')
                callback(null, []);
            },
            setReadyConfig: (_, parameters, callback) => {
                const [clientId] = parameters;
                const conn = this.connections[clientId]
                this.log.debug(`${conn.clientId} - setReadyConfig`);
                callback(null, '');
            },
            updateDevice: (_, parameters, callback) => {
                const [clientId, deviceAddr, hint] = parameters;
                this.log.debug(`${clientId} - updateDevice`);
                this.emit(CCU_EVENT_ON_UPDATE_DEVICE, this.getConnectionInfo(clientId), deviceAddr, hint);
                callback(null, '');
            },
            replaceDevice: (_, parameters, callback) => {
                const [clientId, oldDeviceAddr, newDeviceAddr] = parameters;
                this.log.debug(`${clientId} - replaceDevice`);
                this.emit(CCU_EVENT_ON_REPLACE_DEVICE, this.getConnectionInfo(clientId), oldDeviceAddr, newDeviceAddr);
                callback(null, '');
            },
            readdedDevice: (_, parameters, callback) => {
                const [clientId, deviceAddrs] = parameters;
                this.log.debug(`${clientId} - readdedDevice`);
                this.emit(CCU_EVENT_ON_READD_DEVICE, this.getConnectionInfo(clientId), deviceAddrs);
                callback(null, '');
            },
            newDevices: (_, parameters, callback) => {
                const [clientId, devices] = parameters;

                this.log.info(`${clientId} - newDevices (channels): ${devices.length}`);
                this.updateNameMappings().then(() => {
                    this.emit(CCU_EVENT_ON_NEW_DEVICES, this.getConnectionInfo(clientId), devices);
                    callback(null, '');
                })

            },
            deleteDevices: (_, parameters, callback) => {
                const [clientId, deviceAddrs] = parameters;
                this.emit(CCU_EVENT_ON_DELETE_DEVICE, this.getConnectionInfo(clientId), deviceAddrs);
                this.log.info(`${clientId} - deleteDevices: ${deviceAddrs}`);
                callback(null, '');
            },
            event: (err, params, callback) => {
                // this.log.debug('event:', params);
                this.event(params);
                callback(null, '');
            },
            'system.multicall': (err, params, callback) => {
                this.log.debug('multicall:', params);
                var response = [];
                params[0].forEach((call) => {
                    if (call.methodName in handlers) {
                        handlers[call.methodName](null, call.params, (err, resp) => {
                            response.push(resp);
                        })
                    } else {
                        this.log.warn('Warning: No handler for %s', call.methodName);
                        response.push('');
                    }

                });
                callback(null, response);
            }
        }


        Object.keys(handlers).forEach(methodName => {
            server.on(methodName, (err, parameters, callback) => {
                if (err) {
                    this.log.error('xmlrpc-server error: %s', methodName, err);
                }

                if (isIterable(parameters)) {
                    handlers[methodName](err, parameters, callback);
                } else {
                    this.log.error('xmlrpc-server error: %s %s %s', methodName, 'params not iterable', JSON.stringify(parameters));
                    callback(null, '');
                }
            });

        });


        // server.on('system.listMethods', handlers['system.listMethods'].bind(this));

        // server.on('listDevices', handlers.listDevices.bind(this));

        // server.on('event', handlers.event.bind(this));

        // server.on('system.multicall', handlers["system.multicall"].bind(this));
    }


    public async methodCall(connection: CCUConnection | string, methodName, params: any[]): Promise<any> {
        const CHUNK_SIZE = 15
        const conn = (typeof connection) === 'string' ? this.connections[connection as string] : connection as CCUConnection;
        if (!conn) {
            return Promise.reject(new Error("Connection is null or invalid clientId was given!"));
        }

        const timerstart = Date.now();

        if (methodName === 'system.multicall') {

            if (conn.protocol !== 'hmip-rf' && params[0].length > CHUNK_SIZE) {
                let result: any[] = [];
                for (let index = 0; index < params[0].length; index += CHUNK_SIZE) {
                    const chunk = params[0].slice(index, index + CHUNK_SIZE);
                    const res = await this.methodCall(conn, methodName, [chunk])
                    result = [...result, ...res];

                }
                this.log.debug(`${methodName} merged runtime: ${Date.now() - timerstart}ms`)
                // this.log.debug('MERGED Result: ',result)
                return Promise.resolve(result);
            }

            if (conn.protocol === 'hmip-rf') {
                let result: any[] = [];
                for (let index = 0; index < params[0].length; index++) {
                    const multicallParam: { methodName: string, params: any[] } = params[0][index];
                    // this.log.verbose(`Calling ${multicallParam.methodName}`, {params: multicallParam.params, "atindex": params[0][index]})
                    const res = await this.methodCall(conn, multicallParam.methodName, multicallParam.params)
                    result.push([res])

                }
                this.log.debug(`${methodName} merged runtime: ${Date.now() - timerstart}ms`)
                this.log.debug('MERGED Result: ', result)
                return Promise.resolve(result);
            }
        }

        return new Promise<any>((resolve, reject) => {

            var callFinished = false;
            var timedOut = false;

            const callTimeoutRef = setTimeout(() => {
                this.log.error(`Timeout for request for ${conn.protocol} - ${methodName} - ${JSON.stringify(params)}`)
                timedOut = true;
                if (!callFinished) {
                    this.log.verbose(`${methodName} runtime: ${Date.now() - timerstart}ms`)
                    reject(new Error(`Timeout for request for ${conn.protocol} - ${methodName} - ${JSON.stringify(params)}`));
                }
            }, 60000);


            conn.client.methodCall(methodName, params, (err, res) => {
                if (timedOut) {
                    return;
                }

                callFinished = true;
                clearTimeout(callTimeoutRef);

                if (!err) {
                    // this.log.debug('Normal Result: ',res)
                    const time = Date.now() - timerstart;
                    if (time > 20000) { this.log.warn(`WARNING: ${methodName} runtime: ${time}ms`) }
                    resolve(res);
                } else {
                    reject(err);
                }
            });

        });
    }

    public async putParamset(connection: CCUConnection | string, address: string, paramsetKey: 'MASTER' | 'VALUES', paramset: ParamsetDescription, burst = false) {
        if (burst) {
            return this.methodCall(connection, 'putParamset', [address, paramsetKey, paramset, 'BURST']);
        }
        return this.methodCall(connection, 'putParamset', [address, paramsetKey, paramset]);
    }

    private getConnectionInfo(connection: CCUConnection | string): CCUConnectionInfo {
        const conn = (typeof connection) === 'string' ? this.connections[connection as string] : connection as CCUConnection;
        return { protocol: conn?.protocol, clientId: conn?.clientId, lastEvent: conn?.lastEvent, ccu: this }
    }

    private event(params) {
        const [client_id, address, datapoint, value] = params;
        const device_name = this.channelNameMappings[address]?.name;

        const conn = this.connections[client_id];

        const message = <CCUDeviceMessage>{
            deviceName: device_name,
            deviceAddress: address,
            datapoint: datapoint,
            value: value
        }

        this.log.debug(`event ${client_id}, ${this.channelNameMappings[address]?.name} ${datapoint} - ${value}`);
        this.emit(CCU_EVENT_ON_DEVICE_MESSAGE, this.getConnectionInfo(conn), message);
    }


    private async getNameMappings(): Promise<NameMappings> {
        return new Promise((resolve, reject) => {

            var callFinished = false;
            var timedOut = false;

            const callTimeoutRef = setTimeout(() => {
                timedOut = true;
                if (!callFinished) {
                    reject(new Error(`Timeout for getChannels`));
                }
            }, 5000);

            const channels: NameMappings = {};
            this.rega.getChannels((err, res) => {
                if (timedOut) {
                    return;
                }

                callFinished = true;

                clearTimeout(callTimeoutRef);

                if (!err && res) {
                    // this.log.debug("Channels: ", res);
                    res.forEach((channel: NameMapping) => {
                        channels[channel.address] = channel;
                    });
                    resolve(channels);
                } else {
                    reject(err);
                }
            });
        });
    }

    public async getDevices(conn: CCUConnection | string) {
        return this.methodCall(conn, 'listDevices', []).then((res) => {

            return res.filter(dev => dev.PARENT === '')
        })
    }

    private async test(conn: CCUConnection) {

        // this.log.debug("Description: ", inspect(await this.methodCall(conn.clientId, 'system.multicall', [[
        //     { methodName: 'getDeviceDescription', params: ['MEQ0180941', "MASTER"] },
        //     // { methodName: 'listDevices', params: [] }
        // ]]), { showHidden: false, depth: null }));

        // // this.rega.getValues((err, res)=>{
        // //     this.log.debug("Values: ", res);
        // // });


        return Promise.resolve(null);

    }


    private toParamset(set, desc): Paramset {
        const result: Paramset = {};
        // this.log.debug('Paramset: ', set, desc);
        if (!set || !desc || set?.faultCode || desc?.faultCode) {
            return result;
        }
        for (const datapoint in desc) {
            if (Object.prototype.hasOwnProperty.call(desc, datapoint)) {
                const value = set[datapoint];
                const parameter: Datapoint = {
                    id: datapoint,
                    value: value != undefined ? value : null,
                    meta: desc[datapoint]
                }
                result[datapoint] = parameter;
            }
        }
        // this.log.debug('Paramset: ', result);
        return result;
    }

    public async getCCUDevice(conn: string | CCUConnection, address: string): Promise<Device> {
        const result: Device = null;
        const deviceDesc = await this.methodCall(conn, 'getDeviceDescription', [address, 'MASTER']) as DeviceDescription;

        // Skip virtual hm devices (TODO: Find a cleaner way to handle this)
        if (deviceDesc.TYPE === 'HmIP-RCV-50' || deviceDesc.TYPE === 'HM-RCV-50') { return null; }

        const paramset = await this.methodCall(conn, 'getParamset', [address, 'MASTER']);
        const paramsetDesc = await this.methodCall(conn, 'getParamsetDescription', [address, 'MASTER']);

        const deviceConfigParams = this.toParamset(paramset, paramsetDesc);

        const channelCalls = deviceDesc.CHILDREN.map((channel, index, array) => {
            const calls = [
                { methodName: 'getDeviceDescription', params: [channel, 'MASTER'] },
                { methodName: 'getParamset', params: [channel, 'MASTER'] },
                { methodName: 'getParamsetDescription', params: [channel, 'MASTER'] },
                { methodName: 'getParamset', params: [channel, 'VALUES'] },
                { methodName: 'getParamsetDescription', params: [channel, 'VALUES'] },
            ];
            return calls;
        });
        const channelCallsFlat = channelCalls.reduce((a, b) => a.concat(b))
        const channelsData = await this.methodCall(conn, 'system.multicall', [channelCallsFlat]);
        // this.log.verbose("Description: ",inspect(channelsData, { showHidden: false, depth: null }));
        const channels: Channel[] = [];

        for (let index = 0; index < channelsData.length; index += 5) {
            const channelDesc = channelsData[index][0];
            const channelConfig = channelsData[index + 1][0];
            const channelConfigDesc = channelsData[index + 2][0];
            const channelReadings = channelsData[index + 3][0];
            const channelReadingsDesc = channelsData[index + 4][0];

            const config = this.toParamset(channelConfig, channelConfigDesc);
            const readings = this.toParamset(channelReadings, channelReadingsDesc);

            const channel: Channel = {
                name: this.channelNameMappings[channelDesc.ADDRESS]?.name,
                definition: channelDesc,
                config: config,
                readings: readings,
            }

            channels.push(channel);

        }

        return <Device>{
            name: this.channelNameMappings[deviceDesc.ADDRESS]?.name,
            definition: deviceDesc,
            config: deviceConfigParams,
            channels: channels
        };
    }


    private async initConnection(conn: CCUConnection) {
        // return new Promise((resolve, reject) => {
        const url = `http://${this.core.settings.ccu_callback_host}:${this.core.settings.ccu_callback_port}`;
        this.log.verbose(`init  ${conn.clientId} - ${url}`);
        return this.methodCall(conn, 'init', [url, conn.clientId])
            .then((res) => {
                this.log.verbose("Init done: %s", conn.protocol, res);
                conn.connected = true;
                this.emit(CCU_EVENT_ON_CONNECT, this.getConnectionInfo(conn));
                conn.lastEvent = Date.now();
                this.getDevices(conn);
                if (conn.protocol === CCU_PROTO_BIDCOS_RF) { this.test(conn); }
                return res;
            })
            .finally(() => {
                if (this.ifaceConfigs[conn.protocol].ping) {
                    this.checkConnection(conn);
                }
            })


    }


    public checkConnection(conn: CCUConnection) {
        if (!conn.connected) { return; }
        const pingTimeout = 300;

        if (conn.pingTimerRef) { clearTimeout(conn.pingTimerRef); }
        const elapsed = Math.round((Date.now() - (conn?.lastEvent || 0)) / 1000);

        if (elapsed > pingTimeout) {
            conn.timedOut = true;
            conn.connected = false;
            this.emit(CCU_EVENT_ON_DISCONNECT, this.getConnectionInfo(conn));
            this.log.warn(`WARN: ${conn.clientId} ping timeout!`);
            this.reconnectConnection(conn);
            return;
        }
        this.log.debug(`${conn.clientId} - Elapsed: %d`, elapsed);
        if (elapsed >= (pingTimeout / 2)) {
            //this.logger.trace('ping', iface, elapsed);
            this.methodCall(conn, 'ping', [conn.clientId]).then(() => {
                this.log.verbose(`${conn.clientId} - ping succeded!`);
                conn.lastEvent = Date.now();
            }).catch(() => {
                this.log.error(`${conn.clientId} - ping failed!`);
                conn.connected = false;
                this.emit(CCU_EVENT_ON_DISCONNECT, this.getConnectionInfo(conn));
                this.reconnectConnection(conn);
            });
        }
        this.log.debug(`${conn.clientId} - requeuing ping-check`);
        conn.pingTimerRef = setTimeout(() => {
            this.log.debug(`${conn.clientId} - starting ping-check`);
            this.checkConnection(conn);
        }, pingTimeout * 250);

    }

    private reconnectConnection(conn: CCUConnection) {
        const reconnectTime = 20;

        if (conn.connected) { return; }

        if (conn.reconnectTimer) { clearTimeout(conn.reconnectTimer); }

        this.initConnection(conn).then(() => {
            this.log.info(`${conn.clientId} - successully reconnected...`);
            this.emit(CCU_EVENT_ON_RECONNECT, this.getConnectionInfo(conn));
        }).catch((err) => {
            conn.reconnectTimer = setTimeout(() => {
                this.log.error(`${conn.clientId} - reconnecting...`);
                this.reconnectConnection(conn);
            }, reconnectTime * 1000);
        })


    }


    public async unsubscribeAll() {
        for (const clientId in this.connections) {
            if (Object.prototype.hasOwnProperty.call(this.connections, clientId)) {
                const connection = this.connections[clientId];
                await this.unsubscribe(connection);
            }
        }
    }

    public async unsubscribe(conn: CCUConnection) {
        // return new Promise((resolve, reject) => {
        const url = `http://${this.core.settings.ccu_callback_host}:${this.core.settings.ccu_callback_port}}`;
        // this.log.debug(' > ', 'init', [url, '']);
        return this.methodCall(conn, 'init', [url, '']).then((res) => {
            // this.log.debug(`${conn.clientId} - Unsubscibe sucessfull`);
        });


        // });
    }

    public async onDestroy() {
        for (const clientId in this.connections) {
            if (Object.prototype.hasOwnProperty.call(this.connections, clientId)) {
                const conn = this.connections[clientId];
                clearTimeout(conn.pingTimerRef);
                clearTimeout(conn.reconnectTimer);
                conn.connected = false;
                await this.unsubscribe(conn);
                this.emit(CCU_EVENT_ON_DISCONNECT, this.getConnectionInfo(conn));
                this.removeAllListeners();
            }
        }
    }

}