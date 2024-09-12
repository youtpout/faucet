"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSearchParams } from "next/navigation";
import { PublicKey } from "o1js";

// @ts-ignore
const Faucet = ({ accountState }) => {
  const [mina, setMina] = useState<any>();

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (window && (window as any).mina) {
      setMina((window as any).mina);
    }

  }, [])

  const zkState = accountState;


  const claim = async () => {
    try {
      setLoading(true);

      if (mina) {
        console.log("zkState", zkState)
        // get time proof generation
        console.time("claim");
        const user: string = (await mina.requestAccounts())[0];
        await zkState.zkappWorkerClient?.claim(user);

        const json = await zkState.zkappWorkerClient?.getTransactionJSON();
        console.timeEnd("claim");
        await mina.sendTransaction({ transaction: json });
      }
    } catch (error) {
      console.log('swap error', error);
    }
    finally {
      setLoading(false);
    }

  }

  return (
    <>
      <div>
        <div className="flex flex-col  w-[400px]  h-[300px]  rounded" style={{ backgroundColor: "rgb(255, 245, 240)" }}>
          <div className="flex flex-row justify-center w-full ">
            <div className="flex flex-col p-5 gap-5  w-full  items-center">
              <div className="text-xl">
                Faucet
              </div>
              <div className="mt-10">
                <span>Claim 100 FAU tokens</span>
              </div>
              <button onClick={claim} className="w-full bg-cyan-500 text-lg text-white p-1 rounded">
                Claim
              </button>
              {loading && <p>Creating transaction ...</p>}
            </div>
          </div>
        </div >
      </div >
    </>
  );
};

export default Faucet;
