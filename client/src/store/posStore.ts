import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  product: string;
  name: string;
  quantity: number;
  stock: number; // Available stock
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
  updateQuantity: (productId: string, delta: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  calculateTotals: () => void;
}

export const usePosStore = create<POSState>()(
  persist(
    (set, get) => ({
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
              
              // Stock check
              if (newQuantity > item.stock) {
                return item;
              }

              const unitVAT = item.vatAmount / item.quantity;
              const unitTotal = item.totalPrice / item.quantity;
              return {
                ...item,
                quantity: newQuantity,
                vatAmount: unitVAT * newQuantity,
                totalPrice: unitTotal * newQuantity,
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
        const updatedCart = cart.map((item) => {
          if (item.product === productId) {
            const newQuantity = Math.max(0, item.quantity + delta);
            
            // Prevent exceeding stock
            if (delta > 0 && newQuantity > item.stock) {
              return item;
            }

            if (newQuantity === 0) return null;
            
            const unitVAT = item.vatAmount / item.quantity;
            const unitTotal = item.totalPrice / item.quantity;
            
            return {
              ...item,
              quantity: newQuantity,
              vatAmount: unitVAT * newQuantity,
              totalPrice: unitTotal * newQuantity,
            };
          }
          return item;
        }).filter(Boolean) as CartItem[];

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
    }),
    {
      name: 'pos-cart-storage',
    }
  )
);



