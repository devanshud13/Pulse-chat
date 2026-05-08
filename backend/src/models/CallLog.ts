import { Schema, model, Document, Types } from 'mongoose';

export type CallLogStatus = 'missed' | 'rejected' | 'completed';

export interface ICallLog extends Document {
  _id: Types.ObjectId;
  chat: Types.ObjectId;
  caller: Types.ObjectId;
  callee: Types.ObjectId;
  callType: 'audio' | 'video';
  status: CallLogStatus;
  durationSec?: number;
  createdAt: Date;
}

const callLogSchema = new Schema<ICallLog>(
  {
    chat: { type: Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    caller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    callee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    callType: { type: String, enum: ['audio', 'video'], required: true },
    status: { type: String, enum: ['missed', 'rejected', 'completed'], required: true },
    durationSec: { type: Number, min: 0 },
  },
  { timestamps: true },
);

callLogSchema.index({ callee: 1, createdAt: -1 });
callLogSchema.index({ caller: 1, createdAt: -1 });

export const CallLog = model<ICallLog>('CallLog', callLogSchema);
