using GorevPanosu.Api.Data;
using GorevPanosu.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using TaskStatus = GorevPanosu.Api.Data.TaskStatus;

namespace GorevPanosu.Api.Features.Mobile;

public sealed class MobileEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder endpoints)
    {
        var clock = endpoints.ServiceProvider.GetService<TimeProvider>() ?? TimeProvider.System;
        var group = endpoints.MapGroup("/api/mobile");
        group.MapGet("/people", async (AppDbContext db, CancellationToken ct) =>
            Results.Ok(await db.People.AsNoTracking().Where(p => p.IsActive)
                .OrderBy(p => p.FullName).ThenBy(p => p.Id)
                .Select(p => new PersonResponse(p.Id, p.FullName, p.IsActive)).ToListAsync(ct)));
        group.MapGet("/tasks", async (Guid personId, AppDbContext db, CancellationToken ct) =>
        {
            if (!await Active(db, personId, ct)) return Results.NotFound();
            var now = clock.GetUtcNow().UtcDateTime;
            var cutoff = now.AddDays(-30);
            var tasks = await db.Tasks.AsNoTracking().Where(t => t.AssigneeId == personId &&
                (t.Status == TaskStatus.Open || (t.Status == TaskStatus.Completed &&
                    t.CompletedAt >= cutoff && t.CompletedAt <= now)))
                .OrderBy(t => t.CreatedAt).ThenBy(t => t.Id).ToListAsync(ct);
            return Results.Ok(tasks.Select(Response));
        });
        group.MapGet("/tasks/{id:guid}", async (Guid id, Guid personId, AppDbContext db, CancellationToken ct) =>
        {
            var task = await Find(db, id, personId, ct);
            return task is null ? Results.NotFound() : Results.Ok(Response(task));
        });
        group.MapPost("/tasks/{id:guid}/complete", (Guid id, Guid personId, AppDbContext db, CancellationToken ct) =>
            ChangeStatus(id, personId, true, db, ct));
        group.MapPost("/tasks/{id:guid}/reopen", (Guid id, Guid personId, AppDbContext db, CancellationToken ct) =>
            ChangeStatus(id, personId, false, db, ct));
    }

    private static Task<bool> Active(AppDbContext db, Guid personId, CancellationToken ct) =>
        db.People.AnyAsync(p => p.Id == personId && p.IsActive, ct);

    private static async Task<TaskItem?> Find(AppDbContext db, Guid id, Guid personId, CancellationToken ct)
    {
        if (!await Active(db, personId, ct)) return null;
        return await db.Tasks.SingleOrDefaultAsync(t => t.Id == id && t.AssigneeId == personId, ct);
    }

    private static async Task<IResult> ChangeStatus(Guid id, Guid personId, bool complete, AppDbContext db, CancellationToken ct)
    {
        var task = await Find(db, id, personId, ct);
        if (task is null) return Results.NotFound();
        if (complete) task.Complete(); else task.Reopen();
        await db.SaveChangesAsync(ct);
        return Results.Ok(Response(task));
    }

    private static TaskResponse Response(TaskItem task) => new(task.Id, task.Title, task.Description,
        task.DueDate, task.AssigneeId, task.Status.ToString(), task.CreatedAt, task.CompletedAt);

    public sealed record PersonResponse(Guid Id, string FullName, bool IsActive);
    public sealed record TaskResponse(Guid Id, string Title, string? Description, DateOnly? DueDate,
        Guid? AssigneeId, string Status, DateTime CreatedAt, DateTime? CompletedAt);
}
