import { HomieDevice } from "node-homie";
import { Subject } from "rxjs";
import { CCUDeviceMessage } from "../ccu/homematic.model";



export interface IFactoryDevice{
    create(): Promise<void>;
    eventMessage(message: CCUDeviceMessage): void;
}


export abstract class FactoryDevice extends HomieDevice implements IFactoryDevice{
    protected _events$ = new Subject<CCUDeviceMessage>();
    public events$ = this._events$.asObservable();

    create(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    
    public eventMessage(message: CCUDeviceMessage) {
        this._events$.next(message);
    }
    
}