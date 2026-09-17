import { cookies } from "next/headers";
import { pagina } from "@/components/ui";
import { SettingsNav } from "../settings-nav";
import { ThemeSelector } from "./theme-selector";
import { FusoSelector } from "./fuso-selector";
import { Lede } from "@/components/lede";
import { lerFuso } from "@/lib/datas";

export default async function InterfaceSettingsPage() {
  const [fuso, jar] = await Promise.all([lerFuso(), cookies()]);
  return (
    <div className={pagina("estreita")}>
      <SettingsNav />
      <Lede apoio="Vale só para você - cada pessoa do workspace escolhe o seu.">
        Escolha como o painel aparece: claro, escuro, ou de acordo com o
        sistema.
      </Lede>
      <ThemeSelector />
      <FusoSelector
        atual={fuso}
        fusos={Intl.supportedValuesOf("timeZone")}
        manual={jar.get("fuso_manual")?.value === "1"}
      />
    </div>
  );
}
