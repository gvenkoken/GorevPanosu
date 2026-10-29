namespace GorevPanosu.Api.Data;

public enum TaskStatus { Open, Completed }

public sealed class TaskItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateOnly? DueDate { get; set; }
    public Guid? AssigneeId { get; set; }
    public Person? Assignee { get; set; }
    public TaskStatus Status { get; private set; } = TaskStatus.Open;
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; private set; }

    public void Complete()
    {
        if (Status == TaskStatus.Completed) return;
        Status = TaskStatus.Completed;
        CompletedAt = DateTime.UtcNow;
    }

    public void Reopen()
    {
        Status = TaskStatus.Open;
        CompletedAt = null;
    }
}
