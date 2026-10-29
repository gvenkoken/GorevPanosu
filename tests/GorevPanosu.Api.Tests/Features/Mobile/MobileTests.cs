using System.Net;
using System.Net.Http.Json;
using GorevPanosu.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TaskResponse = GorevPanosu.Api.Features.Mobile.MobileEndpoints.TaskResponse;
using PersonResponse = GorevPanosu.Api.Features.Mobile.MobileEndpoints.PersonResponse;

namespace GorevPanosu.Api.Tests.Features.Mobile;

public sealed class MobileTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private static readonly DateTimeOffset Now = new(2030, 6, 15, 12, 0, 0, TimeSpan.Zero);
    private sealed class FixedClock : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => Now;
    }

    [Fact]
    public async Task Lists_only_active_people_and_owned_open_or_recent_tasks()
    {
        using var root = new AppFactory();
        using var factory = root.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            services.AddSingleton<TimeProvider>(new FixedClock())));
        using var client = factory.CreateClient();
        var owner = new Person { FullName = "Owner" };
        var inactive = new Person { FullName = "Inactive", IsActive = false };
        var other = new Person { FullName = "Other" };
        var open = new TaskItem { Title = "Open", AssigneeId = owner.Id };
        var recent = new TaskItem { Title = "29 days", AssigneeId = owner.Id };
        var boundary = new TaskItem { Title = "30 days", AssigneeId = owner.Id };
        var old = new TaskItem { Title = "31 days", AssigneeId = owner.Id };
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.People.AddRange(owner, inactive, other);
            db.Tasks.AddRange(open, recent, boundary, old,
                new TaskItem { Title = "Unassigned" }, new TaskItem { Title = "Other", AssigneeId = other.Id });
            foreach (var (task, days) in new[] { (recent, 29), (boundary, 30), (old, 31) })
            {
                task.Complete();
                db.Entry(task).Property(t => t.CompletedAt).CurrentValue = Now.UtcDateTime.AddDays(-days);
            }
            await db.SaveChangesAsync(Ct);
        }
        var people = (await client.GetFromJsonAsync<PersonResponse[]>("/api/mobile/people", Ct))!;
        Assert.Equal(new[] { owner.Id, other.Id }.Order(), people.Select(p => p.Id).Order());
        Assert.All(people, p => Assert.True(p.IsActive));
        var tasks = (await client.GetFromJsonAsync<TaskResponse[]>($"/api/mobile/tasks?personId={owner.Id}", Ct))!;
        Assert.Equal(new[] { open.Id, recent.Id, boundary.Id }.Order(), tasks.Select(t => t.Id).Order());
        var detail = await client.GetFromJsonAsync<TaskResponse>($"/api/mobile/tasks/{old.Id}?personId={owner.Id}", Ct);
        Assert.Equal(Now.UtcDateTime.AddDays(-31), detail!.CompletedAt);
        foreach (var personId in new[] { inactive.Id, Guid.NewGuid() })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/mobile/tasks?personId={personId}", Ct)).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/mobile/tasks/{open.Id}?personId={personId}", Ct)).StatusCode);
            foreach (var action in new[] { "complete", "reopen" })
                Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"/api/mobile/tasks/{open.Id}/{action}?personId={personId}", null, Ct)).StatusCode);
        }
        using var check = factory.Services.CreateScope();
        var persisted = await check.ServiceProvider.GetRequiredService<AppDbContext>().Tasks.FindAsync([open.Id], Ct);
        Assert.Equal("Open", persisted!.Status.ToString());
        Assert.Null(persisted.CompletedAt);
    }

    [Fact]
    public async Task Ownership_guards_transitions_and_management_routes_are_absent()
    {
        using var factory = new AppFactory();
        using var client = factory.CreateClient();
        var owner = new Person { FullName = "Owner" };
        var other = new Person { FullName = "Other" };
        var task = new TaskItem { Title = "Work", Description = "Details", DueDate = new DateOnly(2030, 1, 2), AssigneeId = owner.Id };
        var unassigned = new TaskItem { Title = "Unassigned" };
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.People.AddRange(owner, other);
            db.Tasks.AddRange(task, unassigned);
            await db.SaveChangesAsync(Ct);
        }
        var path = $"/api/mobile/tasks/{task.Id}";
        var original = (await client.GetFromJsonAsync<TaskResponse>($"{path}?personId={owner.Id}", Ct))!;
        Assert.Equal(task.Title, original.Title);
        Assert.Equal(task.Description, original.Description);
        Assert.Equal(task.DueDate, original.DueDate);
        Assert.Equal(task.CreatedAt, original.CreatedAt);
        foreach (var id in new[] { task.Id, unassigned.Id, Guid.NewGuid() })
        {
            var personId = id == task.Id ? other.Id : owner.Id;
            var denied = $"/api/mobile/tasks/{id}";
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"{denied}?personId={personId}", Ct)).StatusCode);
            foreach (var action in new[] { "complete", "reopen" })
                Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"{denied}/{action}?personId={personId}", null, Ct)).StatusCode);
        }
        Assert.Equal(original, await client.GetFromJsonAsync<TaskResponse>($"{path}?personId={owner.Id}", Ct));
        var completedResponse = await client.PostAsJsonAsync($"{path}/complete?personId={owner.Id}", new { title = "Forged" }, Ct);
        completedResponse.EnsureSuccessStatusCode();
        var completed = (await completedResponse.Content.ReadFromJsonAsync<TaskResponse>(Ct))!;
        Assert.Equal("Completed", completed.Status);
        Assert.NotNull(completed.CompletedAt);
        Assert.Equal(original.Title, completed.Title);
        Assert.Equal(original.CreatedAt, completed.CreatedAt);
        Assert.Equal(completed, await client.GetFromJsonAsync<TaskResponse>($"{path}?personId={owner.Id}", Ct));
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"{path}/reopen?personId={other.Id}", null, Ct)).StatusCode);
        Assert.Equal(completed, await client.GetFromJsonAsync<TaskResponse>($"{path}?personId={owner.Id}", Ct));
        var repeated = await client.PostAsync($"{path}/complete?personId={owner.Id}", null, Ct);
        repeated.EnsureSuccessStatusCode();
        Assert.Equal(completed, await repeated.Content.ReadFromJsonAsync<TaskResponse>(Ct));
        var reopenedResponse = await client.PostAsync($"{path}/reopen?personId={owner.Id}", null, Ct);
        reopenedResponse.EnsureSuccessStatusCode();
        Assert.Equal(original, await reopenedResponse.Content.ReadFromJsonAsync<TaskResponse>(Ct));
        foreach (var response in new[]
        {
            await client.PostAsJsonAsync($"/api/mobile/tasks?personId={owner.Id}", new { title = "New" }, Ct),
            await client.PutAsJsonAsync($"{path}?personId={owner.Id}", new { title = "Edited" }, Ct),
            await client.DeleteAsync($"{path}?personId={owner.Id}", Ct)
        })
            Assert.Contains(response.StatusCode, new[] { HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed });
        using var check = factory.Services.CreateScope();
        var persistedDb = check.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(2, await persistedDb.Tasks.CountAsync(Ct));
        foreach (var expected in new[] { task, unassigned })
        {
            var persisted = await persistedDb.Tasks.SingleAsync(t => t.Id == expected.Id, Ct);
            Assert.Equal(expected.Title, persisted.Title);
            Assert.Equal(expected.Description, persisted.Description);
            Assert.Equal(expected.DueDate, persisted.DueDate);
            Assert.Equal(expected.AssigneeId, persisted.AssigneeId);
            Assert.Equal(expected.CreatedAt, persisted.CreatedAt);
            Assert.Equal("Open", persisted.Status.ToString());
            Assert.Null(persisted.CompletedAt);
        }
    }
}
