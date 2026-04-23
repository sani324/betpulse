import { useLocation } from "wouter";
import { findGame } from "@/lib/game-catalog";
import GenericCasinoGame from "@/pages/GenericCasinoGame";

export default function CatalogGame() {
  const [location, setLocation] = useLocation();
  const slug = location.replace("/play/", "").split("?")[0];
  const config = findGame(slug);

  if (!config) {
    setLocation("/");
    return null;
  }

  return <GenericCasinoGame config={config} />;
}
