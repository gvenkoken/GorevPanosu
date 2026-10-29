using System.Net;
using System.Net.Http.Json;
using GorevPanosu.Api.Data;
using Microsoft.Extensions.DependencyInjection;
using TaskResponse = GorevPanosu.Api.Features.AdminTasks.AdminTasksEndpoints.TaskResponse;

namespace GorevPanosu.Api.Tests.Features.AdminTasks;

public sealed class AdminTasksTests
{
    private const string Url = "/api/admin/tasks";
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static async Task<TaskResponse> Read(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TaskResponse>(Ct))!;
    }

    [Fact]
    public async Task Crud_ignores_client_status_and_times_and_returns_not_found_after_delete()
    {
        using var factory = new AppFactory();
        using var client = factory.CreateClient();
        var forged = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var created = await client.PostAsJsonAsync(Url, new
        {
            title = "Original", status = "Completed", createdAt = forged, completedAt = forged
        }, Ct);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var task = await Read(created);
        var path = $"{Url}/{task.Id}";
        Assert.Equal(path, created.Headers.Location?.OriginalString);
        Assert.Equal("Open", task.Status);
        Assert.Null(task.CompletedAt);
        Assert.NotEqual(forged, task.CreatedAt);
        Assert.NotEqual(default, task.CreatedAt);
        Assert.Equal(DateTimeKind.Utc, task.CreatedAt.Kind);
        Assert.Equal("Atanmamış", task.AssigneeName);
        using (var scope = factory.Services.CreateScope())
        {
            var persisted = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Tasks.FindAsync([task.Id], Ct);
            Assert.Equal(persisted!.CreatedAt, task.CreatedAt);
        }
        var due = new DateOnly(2030, 2, 3);
        var updated = await Read(await client.PutAsJsonAsync(path, new
        {
            title = "Edited", description = "Details", dueDate = due,
            status = "Completed", createdAt = forged, completedAt = forged
        }, Ct));
        Assert.Equal("Edited", updated.Title);
        Assert.Equal("Details", updated.Description);
        Assert.Equal(due, updated.DueDate);
        Assert.Equal(task.CreatedAt, updated.CreatedAt);
        Assert.Equal("Open", updated.Status);
        Assert.Null(updated.CompletedAt);
        Assert.Equal(updated, await client.GetFromJsonAsync<TaskResponse>(path, Ct));
        Assert.Equal(updated, Assert.Single((await client.GetFromJsonAsync<TaskResponse[]>(Url, Ct))!));
        var cleared = await Read(await client.PutAsJsonAsync(path, new { title = "Minimal" }, Ct));
        Assert.Null(cleared.Description);
        Assert.Null(cleared.DueDate);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(path, Ct)).StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<TaskResponse[]>(Url, Ct))!);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(path, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync(path, new { title = "Missing" }, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync(path, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync($"{path}/assign", new { assigneeId = (Guid?)null }, Ct)).StatusCode);
        foreach (var operation in new[] { "complete", "reopen" })
            Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"{path}/{operation}", null, Ct)).StatusCode);
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(121, false)]
    [InlineData(120, true)]
    public async Task Title_length_is_validated_on_create_and_update(int length, bool valid)
    {
        using var factory = new AppFactory();
        using var client = factory.CreateClient();
        var original = await Read(await client.PostAsJsonAsync(Url, new { title = "Original" }, Ct));
        var title = new string('a', length);
        Assert.Equal(valid ? HttpStatusCode.Created : HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync(Url, new { title }, Ct)).StatusCode);
        Assert.Equal(valid ? HttpStatusCode.OK : HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync($"{Url}/{original.Id}", new { title }, Ct)).StatusCode);
        Assert.Equal(valid ? title : "Original", (await client.GetFromJsonAsync<TaskResponse>($"{Url}/{original.Id}", Ct))!.Title);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(" \t ")]
    public async Task Missing_or_whitespace_title_is_rejected(string? title)
    {
        using var factory = new AppFactory();
        using var client = factory.CreateClient();
        var task = await Read(await client.PostAsJsonAsync(Url, new { title = "Original" }, Ct));
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(Url, new { title }, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Url}/{task.Id}", new { title }, Ct)).StatusCode);
    }

    [Fact]
    public async Task Assignment_accepts_active_people_and_null_and_rejects_inactive_or_missing_people()
    {
        using var factory = new AppFactory();
        using var client = factory.CreateClient();
        var ada = new Person { FullName = "Ada" };
        var grace = new Person { FullName = "Grace" };
        var inactive = new Person { FullName = "Inactive", IsActive = false };
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.People.AddRange(ada, grace, inactive);
            await db.SaveChangesAsync(Ct);
        }
        var task = await Read(await client.PostAsJsonAsync(Url, new { title = "Assigned", assigneeId = ada.Id }, Ct));
        Assert.Equal(ada.Id, task.AssigneeId);
        Assert.Equal("Ada", task.AssigneeName);
        var path = $"{Url}/{task.Id}";
        foreach (var invalid in new[] { inactive.Id, Guid.NewGuid() })
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(Url, new { title = "Invalid", assigneeId = invalid }, Ct)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync(path, new { title = "Invalid", assigneeId = invalid }, Ct)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{path}/assign", new { assigneeId = invalid }, Ct)).StatusCode);
            Assert.Equal(task, await client.GetFromJsonAsync<TaskResponse>(path, Ct));
        }
        foreach (var person in new[] { grace, ada })
        {
            var assigned = await Read(await client.PutAsJsonAsync($"{path}/assign", new { assigneeId = person.Id }, Ct));
            Assert.Equal(person.Id, assigned.AssigneeId);
            Assert.Equal(person.FullName, assigned.AssigneeName);
            Assert.Equal(assigned, await client.GetFromJsonAsync<TaskResponse>(path, Ct));
        }
        var unassigned = await Read(await client.PutAsJsonAsync($"{path}/assign", new { assigneeId = (Guid?)null }, Ct));
        Assert.Null(unassigned.AssigneeId);
        Assert.Equal("Atanmamış", unassigned.AssigneeName);
        var edited = await Read(await client.PutAsJsonAsync(path, new { title = "Edited", assigneeId = grace.Id }, Ct));
        Assert.Equal("Grace", edited.AssigneeName);
        Assert.Equal(grace.Id, edited.AssigneeId);
    }

    [Fact]
    public async Task Complete_and_reopen_persist_server_managed_state()
    {
        using var factory = new AppFactory();
        using var client = factory.CreateClient();
        var task = await Read(await client.PostAsJsonAsync(Url, new { title = "Work" }, Ct));
        var path = $"{Url}/{task.Id}";
        var completed = await Read(await client.PostAsync($"{path}/complete", null, Ct));
        Assert.Equal("Completed", completed.Status);
        Assert.NotNull(completed.CompletedAt);
        Assert.Equal(DateTimeKind.Utc, completed.CompletedAt.Value.Kind);
        Assert.Equal(task.CreatedAt, completed.CreatedAt);
        Assert.Equal(completed, await client.GetFromJsonAsync<TaskResponse>(path, Ct));
        Assert.Equal(completed, await Read(await client.PostAsync($"{path}/complete", null, Ct)));
        var edited = await Read(await client.PutAsJsonAsync(path, new
        {
            title = "Edited", status = "Open", completedAt = (DateTime?)null, createdAt = DateTime.MinValue
        }, Ct));
        Assert.Equal("Completed", edited.Status);
        Assert.Equal(completed.CompletedAt, edited.CompletedAt);
        Assert.Equal(task.CreatedAt, edited.CreatedAt);
        var reopened = await Read(await client.PostAsync($"{path}/reopen", null, Ct));
        Assert.Equal("Open", reopened.Status);
        Assert.Null(reopened.CompletedAt);
        Assert.Equal(task.CreatedAt, reopened.CreatedAt);
        Assert.Equal(reopened, await client.GetFromJsonAsync<TaskResponse>(path, Ct));
    }
}
