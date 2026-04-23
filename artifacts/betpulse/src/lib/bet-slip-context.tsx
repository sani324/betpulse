import { createContext, useContext, useState, ReactNode } from "react";

export type BetSelection = "home" | "draw" | "away";

export interface BetSlipItem {
  id: string; // eventId + selection
  eventId: number;
  homeTeam: string;
  awayTeam: string;
  selection: BetSelection;
  odds: number;
  stake: number;
}

interface BetSlipContextType {
  items: BetSlipItem[];
  addItem: (item: Omit<BetSlipItem, "id" | "stake">) => void;
  removeItem: (id: string) => void;
  updateStake: (id: string, stake: number) => void;
  clearSlip: () => void;
}

const BetSlipContext = createContext<BetSlipContextType | undefined>(undefined);

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BetSlipItem[]>([]);

  const addItem = (item: Omit<BetSlipItem, "id" | "stake">) => {
    const id = `${item.eventId}-${item.selection}`;
    setItems((prev) => {
      if (prev.some((i) => i.id === id)) return prev;
      return [...prev, { ...item, id, stake: 0 }];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateStake = (id: string, stake: number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, stake } : i)));
  };

  const clearSlip = () => setItems([]);

  return (
    <BetSlipContext.Provider value={{ items, addItem, removeItem, updateStake, clearSlip }}>
      {children}
    </BetSlipContext.Provider>
  );
}

export function useBetSlip() {
  const context = useContext(BetSlipContext);
  if (context === undefined) {
    throw new Error("useBetSlip must be used within a BetSlipProvider");
  }
  return context;
}
