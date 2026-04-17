import React from 'react';
export default function TaskList({ tasks, onToggle, onAssign }) {
  return (
    <ul>
      {tasks.map((task, index) => (
        <li key={index}>
          <input type="checkbox" checked={task.completed} onChange={() => onToggle(task.id)} />
          {task.name}
          <select value={task.assignedTo} onChange={(e) => onAssign(task.id, e.target.value)}>
            <option value="">Assign to</option>
            <option value="tech1">Tech 1</option>
            <option value="tech2">Tech 2</option>
          </select>
        </li>
      ))}
    </ul>
  );
}