import { fetchAccount, PublicKey, Field, UInt64 } from "o1js";

import type {
  ZkappWorkerRequest,
  ZkappWorkerReponse,
  WorkerFunctions,
} from "./zkappWorker";

export default class ZkappWorkerClient {
  // ---------------------------------------------------------------------------------------

  setActiveInstanceToDevnet() {
    return this._call("setActiveInstanceToDevnet", {});
  }

  setActiveInstanceToZeko() {
    return this._call("setActiveInstanceToZeko", {});
  }

  async getActiveInstance(): Promise<any> {
    const result = await this._call("getActiveInstance", {}) as unknown as string;
    return JSON.parse(result);
  }


  loadContract() {
    return this._call("loadContract", {});
  }

  compileContract() {
    return this._call("compileContract", {});
  }

  fetchAccount({
    publicKeyBase58,
  }: {
    publicKeyBase58: string;
  }): ReturnType<typeof fetchAccount> {
    const result = this._call("fetchAccount", {
      publicKey58: publicKeyBase58,
    });
    return result as ReturnType<typeof fetchAccount>;
  }

  fetchAccountToken({
    publicKeyBase58,
  }: {
    publicKeyBase58: string;
  }): ReturnType<typeof fetchAccount> {
    const result = this._call("fetchAccountToken", {
      publicKey58: publicKeyBase58,
    });
    return result as ReturnType<typeof fetchAccount>;
  }

  async getBalance(publicKey58: string): Promise<UInt64> {
    const result = await this._call("getBalance", { publicKey58 });
    return UInt64.fromJSON(JSON.parse(result as string));
  }

  initZkappInstance(tokenAddress: PublicKey, faucetAddress: PublicKey) {
    return this._call("initZkappInstance", {
      token: tokenAddress.toBase58(),
      faucet: faucetAddress.toBase58(),
    });
  }

  async claim(user: string) {
    return await this._call("claim", { user });
  }

  async getTransactionJSON(): Promise<string> {
    const result = await this._call("getTransactionJSON", {}) as string;
    return result;
  }


  async getKey() {
    const result = await this._call("getKey", {});
    return result;
  }

  // ---------------------------------------------------------------------------------------

  worker: Worker;

  promises: {
    [id: number]: { resolve: (res: any) => void; reject: (err: any) => void };
  };

  nextId: number;

  constructor() {
    console.time("worker load");
    this.worker = new Worker(new URL("./zkappWorker.ts", import.meta.url));
    this.promises = {};
    this.nextId = 0;

    this.worker.onmessage = (event: MessageEvent<ZkappWorkerReponse>) => {
      if (event.data.error) {
        console.log("error", event.data.error);
        this.promises[event.data.id].reject(event.data.error);
      } else {
        this.promises[event.data.id].resolve(event.data.data);
      }
      delete this.promises[event.data.id];
    };


    this.worker.onerror = (event: ErrorEvent) => {
      console.error("worker error", event);
    };
    console.timeEnd("worker load");
  }


  _call(fn: WorkerFunctions, args: any) {
    return new Promise((resolve, reject) => {
      this.promises[this.nextId] = { resolve, reject };

      const message: ZkappWorkerRequest = {
        id: this.nextId,
        fn,
        args,
      };

      this.worker.postMessage(message);

      this.nextId++;
    });
  }
}
