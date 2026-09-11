import { pagina } from "@/components/ui";
import { SettingsNav } from "../settings-nav";
import { ThemeSelector } from "./theme-selector";
import { Lede } from "@/components/lede";

export default function InterfaceSettingsPage() {
  return (
    <div className={pagina("estreita")}>
      <SettingsNav />
      <Lede apoio="Vale só para você - cada pessoa do workspace escolhe o seu.">
        Escolha como o painel aparece: claro, escuro, ou de acordo com o
        sistema.
      </Lede>
      <ThemeSelector />
    </div>
  );
}
