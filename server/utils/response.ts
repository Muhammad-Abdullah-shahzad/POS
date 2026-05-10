export const successResponse = (data: any, message = 'Success') => {
  return {
    success: true,
    data,
    message
  };
};

export const errorResponse = (message: string, error?: any) => {
  return {
    success: false,
    data: error || null,
    message
  };
};
