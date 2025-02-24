import Joi from 'joi';

const amountSchema = Joi.number().positive().required().messages({
  'number.base': '"amount" must be a number',
  'number.positive': '"amount" must be a positive number',
  'any.required': '"amount" is required'
});

const callbackUrlSchema = Joi.string().uri().required().messages({
  'string.base': '"callbackUrl" must be a string',
  'string.uri': '"callbackUrl" must be a valid URI',
  'any.required': '"callbackUrl" is required'
});

const transactionIdSchema = Joi.string().required().messages({
  'string.base': '"transactionId" must be a string',
  'any.required': '"transactionId" is required'
});

export const validateAmount = (amount) => {
  const { error } = amountSchema.validate(amount);
  if (error) {
    throw new Error(error.details[0].message);
  }
};

export const validateCallbackUrl = (callbackUrl) => {
  const { error } = callbackUrlSchema.validate(callbackUrl);
  if (error) {
    throw new Error(error.details[0].message);
  }
};

export const validateTransactionId = (transactionId) => {
    const { error } = transactionIdSchema.validate(transactionId);
    if (error) {
      throw new Error(error.details[0].message);
    }
  };