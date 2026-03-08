import { create } from 'zustand';
import { Order, Profile } from '../types/database';

interface OrderState {
  activeOrder: Order | null;
  driverInfo: Profile | null;
  // Действия
  setActiveOrder: (order: Order | null) => void;
  setDriverInfo: (info: Profile | null) => void;
  updateOrderStatus: (status: Order['status']) => void;
  resetOrder: () => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  activeOrder: null,
  driverInfo: null,

  setActiveOrder: (order) => set({ activeOrder: order }),
  
  setDriverInfo: (info) => set({ driverInfo: info }),

  updateOrderStatus: (status) => set((state) => ({
    activeOrder: state.activeOrder ? { ...state.activeOrder, status } : null
  })),

  resetOrder: () => set({ activeOrder: null, driverInfo: null }),
}));