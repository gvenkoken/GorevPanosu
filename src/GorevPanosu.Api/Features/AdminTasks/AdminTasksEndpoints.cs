using GorevPanosu.Api.Data;
using GorevPanosu.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace GorevPanosu.Api.Features.AdminTasks;

public sealed class AdminTasksEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/admin/tasks");
        group.MapGet("", async (AppDbContext db, CancellationToken ct) =>
            Results.Ok((await db.Tasks.AsNoTracking().Include(t => t.Assignee)
                .OrderBy(t => t.CreatedAt).ThenBy(t => t.Id).ToListAsync(ct)).Select(Response)));
        group.MapGet("/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var task = await Find(db, id, ct);
            return task is null ? Results.NotFound() : Results.Ok(Response(task));
        });
        group.MapPost("", Create);
        group.MapPut("/{id:guid}", Update);
        group.MapDelete("/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var task = await Find(db, id, ct);
            if (task is null) return Results.NotFound();
            db.Tasks.Remove(task);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
        group.MapPut("/{id:guid}/assign", Assign);
        group.MapPost("/{id:guid}/complete", (Guid id, AppDbContext db, CancellationToken ct) => ChangeStatus(id, true, db, ct));
        group.MapPost("/{id:guid}/reopen", (Guid id, AppDbContext db, CancellationToken ct) => ChangeStatus(id, false, db, ct));
    }

    private static async Task<IResult> Create(TaskRequest request, AppDbContext db, CancellationToken ct)
    {
        var error = await Validate(request, db, ct);
        if (error is not null) return error;
        var task = new TaskItem();
        Apply(task, request);
        db.Tasks.Add(task);
        await db.SaveChangesAsync(ct);
        await db.Entry(task).Reference(t => t.Assignee).LoadAsync(ct);
        return Results.Created($"/api/admin/tasks/{task.Id}", Response(task));
    }

    private static async Task<IResult> Update(Guid id, TaskRequest request, AppDbContext db, CancellationToken ct)
    {
        var task = await Find(db, id, ct);
        if (task is null) return Results.NotFound();
        var error = await Validate(request, db, ct);
        if (error is not null) return error;
        Apply(task, request);
        await db.SaveChangesAsync(ct);
        db.Entry(task).Reference(t => t.Assignee).IsLoaded = false;
        await db.Entry(task).Reference(t => t.Assignee).LoadAsync(ct);
        return Results.Ok(Response(task));
    }

    private static async Task<IResult> Assign(Guid id, AssignmentRequest request, AppDbContext db, CancellationToken ct)
    {
        var task = await Find(db, id, ct);
        if (task is null) return Results.NotFound();
        if (!await ValidAssignee(request.AssigneeId, db, ct)) return InvalidAssignee();
        task.AssigneeId = request.AssigneeId;
        await db.SaveChangesAsync(ct);
        db.Entry(task).Reference(t => t.Assignee).IsLoaded = false;
        await db.Entry(task).Reference(t => t.Assignee).LoadAsync(ct);
        return Results.Ok(Response(task));
    }

    private static async Task<IResult> ChangeStatus(Guid id, bool complete, AppDbContext db, CancellationToken ct)
    {
        var task = await Find(db, id, ct);
        if (task is null) return Results.NotFound();
        if (complete) task.Complete(); else task.Reopen();
        await db.SaveChangesAsync(ct);
        return Results.Ok(Response(task));
    }

    private static Task<TaskItem?> Find(AppDbContext db, Guid id, CancellationToken ct) =>
        db.Tasks.Include(t => t.Assignee).SingleOrDefaultAsync(t => t.Id == id, ct);

    private static async Task<IResult?> Validate(TaskRequest request, AppDbContext db, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 120)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["title"] = ["Title is required and must be at most 120 characters."] });
        return await ValidAssignee(request.AssigneeId, db, ct) ? null : InvalidAssignee();
    }

    private static async Task<bool> ValidAssignee(Guid? id, AppDbContext db, CancellationToken ct) =>
        id is null || await db.People.AnyAsync(p => p.Id == id && p.IsActive, ct);

    private static IResult InvalidAssignee() => Results.ValidationProblem(
        new Dictionary<string, string[]> { ["assigneeId"] = ["Assignee must be an active person or null."] });

    private static void Apply(TaskItem task, TaskRequest request)
    {
        task.Title = request.Title!.Trim();
        task.Description = request.Description;
        task.DueDate = request.DueDate;
        task.AssigneeId = request.AssigneeId;
    }

    private static TaskResponse Response(TaskItem task) => new(task.Id, task.Title, task.Description,
        task.DueDate, task.AssigneeId, task.Assignee?.FullName ?? "Atanmamış", task.Status.ToString(), task.CreatedAt, task.CompletedAt);

    public sealed record TaskRequest(string? Title, string? Description = null, DateOnly? DueDate = null, Guid? AssigneeId = null);
    public sealed record AssignmentRequest(Guid? AssigneeId);
    public sealed record TaskResponse(Guid Id, string Title, string? Description, DateOnly? DueDate,
        Guid? AssigneeId, string AssigneeName, string Status, DateTime CreatedAt, DateTime? CompletedAt);
}
