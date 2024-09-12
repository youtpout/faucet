"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSearchParams } from "next/navigation";
import { fetchAccount, PublicKey } from "o1js";
// @ts-ignore
import CurrencyFormat from "react-currency-format";

// @ts-ignore
const Account = ({ accountState }) => {
  const [mina, setMina] = useState<any>();
  const [information, setInformation] = useState<any>({ account: "", network: "" });
  const [balances, setBalances] = useState<any>({ mina: 0, token: 0, liquidity: 0 });
  const [isZeko, setIsZeko] = useState(true);
  const devnetGraph = "https://api.minascan.io/node/devnet/v1/graphql";

  const zkState = accountState;

  useEffect(() => {
    if (window && (window as any).mina) {
      const windowMina = (window as any).mina;
      setMina(windowMina);
      windowMina.requestAccounts().then(x => {      
        getUserInformation(windowMina).then(x => setInformation(x))
      })
    }
  }, [])

  useEffect(() => {
    const intervalID = setInterval(() => {
      if (mina) {
        console.log("get info");
        getUserInformation(mina).then(x => setInformation(x))
      }
    }, 15000);

    return () => clearInterval(intervalID);
  }, [mina])


  const getBalances = async (user: string, graphUrl: string) => {
    console.log("getBalances");
    const publicKey = PublicKey.fromBase58(user);
    const accMina = await fetchAccount({ publicKey }, graphUrl);
    const acc = await fetchAccount({ publicKey, tokenId: "wvsWGoCczQEDuUaiyeN67xrvgvYnxUohhhFHRBy6ruQutcbd1i" }, graphUrl);
    const bal = accMina.account ? accMina.account.balance : 0;
    const balToken = acc.account ? acc.account.balance : 0;

    const mina = parseInt(bal.toString()) / 10 ** 9;
    const token = parseInt(balToken.toString()) / 10 ** 9;
    return { mina, token };
  }

  const getUserInformation = async (auroMina) => {
    try {
      const accounts = await auroMina?.getAccounts();
      const account = accounts?.length ? accounts[0] : "";
      const network = await auroMina?.requestNetwork();
      console.log("account", account);
      console.log("network", network);

      if (account) {
        const newBalances = await getBalances(account, devnetGraph);
        setBalances(newBalances);
      }
      return { account, network: network?.networkID };
    } catch (error) {
      console.error("getUserInformation", error);
    }
  }

  const trimText = (text: string) => {
    if (!text) {
      return "";
    }
    return text.substring(0, 4) + "..." + text.substring(text.length - 4, text.length);
  }

  const connect = async () => {
    if (mina) {
      await mina.requestAccounts();
      const info = await getUserInformation(mina);
      setInformation(info);
    }
  }

  return (
    <>
      <div className="flex flex-row justify-between items-center w-screen menu" style={{ position: "fixed", top: "0", left: "0", backgroundColor: "white" }} >
        <div>
          <img className="h-10" src="/assets/mina.png" />
        </div>
        <div>

        </div>
        {information?.account && <div className="flex flex-row">
          <div>
            <span>{Math.trunc(balances?.mina)} MINA</span>
          </div>
          <div>
            <span title="Token">{Math.trunc(balances?.token)} FAU</span>
          </div>
          <div>
            <span title={information?.account}>{trimText(information?.account)}</span>
          </div>
        </div>}
        {!information?.account &&
          <button onClick={() => connect().then()}>Connect Wallet</button>
        }
      </div>
    </>
  );
};

export default Account;
