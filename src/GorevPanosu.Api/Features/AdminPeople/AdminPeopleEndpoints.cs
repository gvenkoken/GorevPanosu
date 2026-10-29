using GorevPanosu.Api.Data;
using GorevPanosu.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using TaskStatus = GorevPanosu.Api.Data.TaskStatus;

namespace GorevPanosu.Api.Features.AdminPeople;

public sealed class AdminPeopleEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/admin/people");
        group.MapGet("", async (AppDbContext db, CancellationToken cancellationToken) =>
            Results.Ok(await db.People.AsNoTracking().OrderBy(p => p.FullName).ThenBy(p => p.Id)
                .Select(p => new PersonResponse(p.Id, p.FullName, p.IsActive,
                    db.Tasks.Count(t => t.AssigneeId == p.Id && t.Status == TaskStatus.Open)))
                .ToListAsync(cancellationToken)));
        group.MapPost("", Create);
        group.MapPut("/{id:guid}", Rename);
        group.MapPost("/{id:guid}/deactivate", Deactivate);
    }

    private static async Task<IResult> Create(NameRequest request, AppDbContext db, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.FullName)) return InvalidName();
        var person = new Person { FullName = request.FullName.Trim() };
        db.People.Add(person);
        await db.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/admin/people/{person.Id}", new PersonResponse(person.Id, person.FullName, person.IsActive, 0));
    }

    private static async Task<IResult> Rename(Guid id, NameRequest request, AppDbContext db, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.FullName)) return InvalidName();
        var person = await db.People.FindAsync([id], cancellationToken);
        if (person is null) return Results.NotFound();
        person.FullName = request.FullName.Trim();
        await db.SaveChangesAsync(cancellationToken);
        var count = await db.Tasks.CountAsync(t => t.AssigneeId == id && t.Status == TaskStatus.Open, cancellationToken);
        return Results.Ok(new PersonResponse(id, person.FullName, person.IsActive, count));
    }

    private static async Task<IResult> Deactivate(Guid id, DeactivateRequest request, AppDbContext db, CancellationToken cancellationToken)
    {
        var person = await db.People.FindAsync([id], cancellationToken);
        if (person is null) return Results.NotFound();
        var openTasks = await db.Tasks.Where(t => t.AssigneeId == id && t.Status == TaskStatus.Open)
            .ToListAsync(cancellationToken);
        if (openTasks.Count > 0 && !request.Confirm)
            return Results.Problem(statusCode: StatusCodes.Status409Conflict,
                title: "Confirmation required to unassign open tasks.",
                extensions: new Dictionary<string, object?> { ["openTaskCount"] = openTasks.Count });

        person.IsActive = false;
        foreach (var task in openTasks) task.AssigneeId = null;
        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new PersonResponse(id, person.FullName, person.IsActive, 0));
    }

    private static IResult InvalidName() => Results.ValidationProblem(
        new Dictionary<string, string[]> { ["fullName"] = ["Full name is required."] });

    public sealed record NameRequest(string? FullName);
    public sealed record DeactivateRequest(bool Confirm = false);
    public sealed record PersonResponse(Guid Id, string FullName, bool IsActive, int OpenTaskCount);
}
