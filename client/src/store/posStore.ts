import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  product: string;
  name: string;
  category: string;
  quantity: number;
  stock: number;
  price: number;        // Unit base price (ex-VAT)
  vatRate: number;
  vatAmount: number;    // Total VAT for this quantity
  totalPrice: number;   // Total after VAT, before discount
  discountPct: number;  // Discount % applied (0 if none)
  discountAmt: number;  // Total discount amount for this quantity
  finalPrice: number;   // totalPrice - discountAmt
  discountLabel?: string; // Optional label for discount source
}

export interface LastTransaction {
  transNo: string;
  transAmt: number;
  paidAmt: number;
  returnAmt: number;
  dueAmt: number;
  date: string;
}

interface POSState {
  cart: CartItem[];
  subtotal: number;
  totalVAT: number;
  totalDiscount: number;
  total: number;
  lastTransaction: LastTransaction | null;
  addToCart: (item: CartItem) => void;
  updateQuantity: (productId: string, delta: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  calculateTotals: () => void;
  setLastTransaction: (tx: LastTransaction) => void;
}

export const usePosStore = create<POSState>()(
  persist(
    (set, get) => ({
      cart: [],
      subtotal: 0,
      totalVAT: 0,
      totalDiscount: 0,
      total: 0,
      lastTransaction: null,

      addToCart: (newItem) => {
        const { cart } = get();
        const existing = cart.find((item) => item.product === newItem.product);
        let updatedCart;

        if (existing) {
          updatedCart = cart.map((item) => {
            if (item.product === newItem.product) {
              const newQuantity = item.quantity + 1;
              if (newQuantity > item.stock) return item;
              const unitVAT = item.vatAmount / item.quantity;
              const unitTotal = item.totalPrice / item.quantity;
              const unitDiscount = item.discountAmt / item.quantity;
              const unitFinal = item.finalPrice / item.quantity;
              return {
                ...item,
                quantity: newQuantity,
                vatAmount: unitVAT * newQuantity,
                totalPrice: unitTotal * newQuantity,
                discountAmt: unitDiscount * newQuantity,
                finalPrice: unitFinal * newQuantity,
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

      updateQuantity: (productId, delta) => {
        const { cart } = get();
        const updatedCart = cart
          .map((item) => {
            if (item.product === productId) {
              const newQuantity = Math.max(0, item.quantity + delta);
              if (delta > 0 && newQuantity > item.stock) return item;
              if (newQuantity === 0) return null;
              const unitVAT = item.vatAmount / item.quantity;
              const unitTotal = item.totalPrice / item.quantity;
              const unitDiscount = item.discountAmt / item.quantity;
              const unitFinal = item.finalPrice / item.quantity;
              return {
                ...item,
                quantity: newQuantity,
                vatAmount: unitVAT * newQuantity,
                totalPrice: unitTotal * newQuantity,
                discountAmt: unitDiscount * newQuantity,
                finalPrice: unitFinal * newQuantity,
              };
            }
            return item;
          })
          .filter(Boolean) as CartItem[];

        set({ cart: updatedCart });
        get().calculateTotals();
      },

      removeFromCart: (productId) => {
        const { cart } = get();
        set({ cart: cart.filter((item) => item.product !== productId) });
        get().calculateTotals();
      },

      clearCart: () => {
        set({ cart: [], subtotal: 0, totalVAT: 0, totalDiscount: 0, total: 0 });
      },

      calculateTotals: () => {
        const { cart } = get();
        let subtotal = 0;
        let totalVAT = 0;
        let totalDiscount = 0;
        cart.forEach((item) => {
          subtotal += item.totalPrice - item.vatAmount;
          totalVAT += item.vatAmount;
          totalDiscount += item.discountAmt;
        });
        set({ subtotal, totalVAT, totalDiscount, total: subtotal + totalVAT - totalDiscount });
      },

      setLastTransaction: (tx) => {
        set({ lastTransaction: tx });
      },
    }),
    {
      name: 'pos-cart',
      partialize: (state) => ({
        cart: state.cart,
        subtotal: state.subtotal,
        totalVAT: state.totalVAT,
        totalDiscount: state.totalDiscount,
        total: state.total,
        lastTransaction: state.lastTransaction,
      }),
    }
  )
);
