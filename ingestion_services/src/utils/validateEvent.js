import Joi from "joi";

const schema = Joi.object({
  site_id: Joi.string().required(),
  event_type: Joi.string().required(),
  path: Joi.string().required(),
  user_id: Joi.string().allow(null, ""),
  timestamp: Joi.string().isoDate().required(),
});

 export const validateEvent = (payload) => {
  return schema.validate(payload, { convert: true });
}


