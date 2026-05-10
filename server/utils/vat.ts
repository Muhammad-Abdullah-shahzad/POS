export const calculateVAT = (price: number, rate: number, type: 'inclusive' | 'exclusive') => {
  if (type === 'inclusive') {
    return extractVAT(price, rate);
  } else {
    return addVAT(price, rate);
  }
};

export const extractVAT = (inclusivePrice: number, rate: number) => {
  const vatAmount = inclusivePrice - (inclusivePrice / (1 + rate / 100));
  const basePrice = inclusivePrice - vatAmount;
  return { basePrice, vatAmount, totalPrice: inclusivePrice };
};

export const addVAT = (exclusivePrice: number, rate: number) => {
  const vatAmount = exclusivePrice * (rate / 100);
  const totalPrice = exclusivePrice + vatAmount;
  return { basePrice: exclusivePrice, vatAmount, totalPrice };
};
