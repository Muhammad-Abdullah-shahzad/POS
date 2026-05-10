import { create } from 'zustand';

export interface CartItem {
  product: string;
  name: string;
  quantity: number;
  price: number; // Unit price
  vatRate: number;
  vatAmount: number; // Total VAT for this quantity
  totalPrice: number; // Total Price for this quantity
}

interface POSState {
  cart: CartItem[];
  subtotal: number;
  totalVAT: number;
  total: number;
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  calculateTotals: () => void;
}

export const usePosStore = create<POSState>((set, get) => ({
  cart: [],
  subtotal: 0,
  totalVAT: 0,
  total: 0,

  addToCart: (newItem) => {
    const { cart } = get();
    const existing = cart.find((item) => item.product === newItem.product);
    let updatedCart;

    if (existing) {
      updatedCart = cart.map((item) => {
        if (item.product === newItem.product) {
          const newQuantity = item.quantity + 1;
          return {
            ...item,
            quantity: newQuantity,
            vatAmount: (item.vatAmount / item.quantity) * newQuantity,
            totalPrice: (item.totalPrice / item.quantity) * newQuantity,
          };
        }
        return item;
      });
    } else {
      updatedCart = [...cart, newItem];
    }

    set({ cart: updatedCart });
    get().calculateTotals();
  },

  removeFromCart: (productId) => {
    const { cart } = get();
    set({ cart: cart.filter((item) => item.product !== productId) });
    get().calculateTotals();
  },

  clearCart: () => {
    set({ cart: [], subtotal: 0, totalVAT: 0, total: 0 });
  },

  calculateTotals: () => {
    const { cart } = get();
    let subtotal = 0;
    let totalVAT = 0;

    cart.forEach((item) => {
      // Calculate based on unit price to handle precision
      const itemBase = (item.totalPrice - item.vatAmount);
      subtotal += itemBase;
      totalVAT += item.vatAmount;
    });

    set({ subtotal, totalVAT, total: subtotal + totalVAT });
  },
}));



