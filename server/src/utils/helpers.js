import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, phone: user.phone, role: user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

export const generateReferralCode = (phone) => {
  return `LUDU${phone.slice(-4)}${uuidv4().slice(0, 4).toUpperCase()}`;
};

export const generateRoomCode = () => {
  return `ROOM-${uuidv4().slice(0, 6).toUpperCase()}`;
};

export const formatCurrency = (amount) => {
  return Number(amount).toLocaleString('bn-BD');
};
