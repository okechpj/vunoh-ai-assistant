const supabase = require('./src/db/supabase');

async function testConnection() {
  console.log("Testing connection to Supabase...");
  try {
    const { data, error } = await supabase.from('tasks').select('*').limit(1);
    if (error) {
      console.error("Connection failed with error:");
      console.error(error);
    } else {
      console.log("Connection successful!");
      console.log("Data retrieved:", data);
    }
  } catch (err) {
    console.error("Unexpected error:", err.message);
  }
}

testConnection();
