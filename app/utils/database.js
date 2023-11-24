import mongoose from 'mongoose';
import regeneratorRuntime from 'regenerator-runtime'; //YOU SHOULD NOT DELETE THIS LINE!!!!

const debug = process.env.LOGS_DB === 'true';
mongoose.set('debug', debug);
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('runValidators', true);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);

let dbConnection = null;
dbConnection = async () => await mongoose.connect(`mongodb://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_IP}:${process.env.DATABASE_PORT}/${process.env.DATABASE}`);

export { mongoose };
export default dbConnection;