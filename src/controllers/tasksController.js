exports.createRequest = (req, res) => {
  const { text } = req.body;
  console.log(`[POST /request] Received new request: ${text}`);
  
  return res.status(201).json({
    success: true,
    message: 'Request received (Skeleton implementation)',
    data: { id: 'dummy-1234', original_text: text, status: 'Pending' }
  });
};

exports.getTasks = (req, res) => {
  console.log('[GET /tasks] Fetching tasks');
  return res.status(200).json({
    success: true,
    data: [] // skeleton empty array
  });
};

exports.getTaskById = (req, res) => {
  const { id } = req.params;
  console.log(`[GET /tasks/:id] Fetching task by id: ${id}`);
  return res.status(200).json({
    success: true,
    data: { id, status: 'Pending' }
  });
};

exports.updateTaskStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  console.log(`[PATCH /tasks/:id/status] Updating task ${id} to status ${status}`);
  return res.status(200).json({
    success: true,
    message: 'Status updated (Skeleton implementation)'
  });
};
