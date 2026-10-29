using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AdminTask = GorevPanosu.Api.Features.AdminTasks.AdminTasksEndpoints.TaskResponse;
using MobileTask = GorevPanosu.Api.Features.Mobile.MobileEndpoints.TaskResponse;
using Person = GorevPanosu.Api.Features.AdminPeople.AdminPeopleEndpoints.PersonResponse;
using MobilePerson = GorevPanosu.Api.Features.Mobile.MobileEndpoints.PersonResponse;

namespace GorevPanosu.Api.Tests.EndToEnd;

// Review scenarios derived from the architecture; these do not replace deferred human AC01 approval.
public sealed class AcceptanceScenarioTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Web_create_assign_mobile_complete_reopen_and_web_refresh_preserve_state_and_times()
    {
        using var factory = new AppFactory();
        using var web = factory.CreateClient();
        using var mobile = factory.CreateClient();
        var person = await CreatePerson(web, "Ada");
        Assert.Contains(await People(mobile), p => p.Id == person.Id && p.IsActive);

        var created = await CreateTask(web, "Review release");
        Assert.Null(created.AssigneeId);
        Assert.Equal("Open", created.Status);
        Assert.Null(created.CompletedAt);
        Assert.NotEqual(default, created.CreatedAt);
        Assert.Equal(DateTimeKind.Utc, created.CreatedAt.Kind);

        var assigned = await Assign(web, created.Id, person.Id);
        Assert.Equal(person.Id, assigned.AssigneeId);
        Assert.Equal(person.FullName, assigned.AssigneeName);
        Assert.Equal(created.CreatedAt, assigned.CreatedAt);
        Assert.Equal("Open", assigned.Status);
        Assert.Null(assigned.CompletedAt);
        var visible = Assert.Single(await Tasks(mobile, person.Id));
        AssertTask(assigned, visible);
        Assert.Equal(visible, await Get<MobileTask>(mobile, MobilePath(created.Id, person.Id)));

        var completed = await Read<MobileTask>(await mobile.PostAsync(
            MobilePath(created.Id, person.Id, "/complete"), null, Ct), HttpStatusCode.OK);
        Assert.Equal("Completed", completed.Status);
        Assert.NotNull(completed.CompletedAt);
        Assert.Equal(DateTimeKind.Utc, completed.CompletedAt.Value.Kind);
        Assert.Equal(visible with { Status = "Completed", CompletedAt = completed.CompletedAt }, completed);
        Assert.Equal(completed, await Get<MobileTask>(mobile, MobilePath(created.Id, person.Id)));
        AssertTask(Assert.Single(await WebTasks(web)), completed);

        var reopened = await Read<MobileTask>(await mobile.PostAsync(
            MobilePath(created.Id, person.Id, "/reopen"), null, Ct), HttpStatusCode.OK);
        Assert.Equal(visible, reopened);
        Assert.Equal(reopened, Assert.Single(await Tasks(mobile, person.Id)));
        var refreshed = Assert.Single(await WebTasks(web));
        Assert.Equal(assigned, refreshed);
        AssertTask(refreshed, reopened);
    }

    [Fact]
    public async Task Reassignment_moves_visibility_and_unassigned_tasks_are_hidden_from_every_person()
    {
        using var factory = new AppFactory();
        using var web = factory.CreateClient();
        using var mobile = factory.CreateClient();
        var former = await CreatePerson(web, "Former owner");
        var next = await CreatePerson(web, "Next owner");
        var task = await CreateTask(web, "Move ownership");
        var unassigned = await CreateTask(web, "Unassigned");
        await Assign(web, task.Id, former.Id);
        Assert.Equal(task.Id, Assert.Single(await Tasks(mobile, former.Id)).Id);
        Assert.Empty(await Tasks(mobile, next.Id));

        var moved = await Assign(web, task.Id, next.Id);
        Assert.Empty(await Tasks(mobile, former.Id));
        AssertTask(moved, Assert.Single(await Tasks(mobile, next.Id)));
        await AssertInaccessible(mobile, task.Id, former.Id);
        foreach (var person in await People(mobile))
        {
            Assert.DoesNotContain(await Tasks(mobile, person.Id), t => t.Id == unassigned.Id);
            await AssertInaccessible(mobile, unassigned.Id, person.Id);
        }

        await Assign(web, task.Id, null);
        foreach (var person in await People(mobile))
            Assert.Empty(await Tasks(mobile, person.Id));
        var refreshed = await WebTasks(web);
        Assert.Equal(2, refreshed.Length);
        Assert.All(refreshed, t => Assert.Null(t.AssigneeId));
        Assert.All(refreshed, t => Assert.Equal("Open", t.Status));
        Assert.All(refreshed, t => Assert.Null(t.CompletedAt));
    }

    [Fact]
    public async Task Deactivation_warns_before_unassigning_open_tasks_and_blocks_inactive_mobile_requests()
    {
        using var factory = new AppFactory();
        using var web = factory.CreateClient();
        using var mobile = factory.CreateClient();
        var person = await CreatePerson(web, "Ada");
        var open = await Assign(web, (await CreateTask(web, "Open work")).Id, person.Id);
        var done = await Assign(web, (await CreateTask(web, "Completed work")).Id, person.Id);
        var completed = await Read<MobileTask>(await mobile.PostAsync(
            MobilePath(done.Id, person.Id, "/complete"), null, Ct), HttpStatusCode.OK);
        var completedOnWeb = await Get<AdminTask>(web, $"/api/admin/tasks/{done.Id}");
        AssertTask(completedOnWeb, completed);

        var path = $"/api/admin/people/{person.Id}/deactivate";
        using (var warning = await web.PostAsJsonAsync(path, new { confirm = false }, Ct))
        {
            Assert.Equal(HttpStatusCode.Conflict, warning.StatusCode);
            var problem = await warning.Content.ReadFromJsonAsync<JsonElement>(Ct);
            Assert.Equal(1, problem.GetProperty("openTaskCount").GetInt32());
        }
        Assert.True(Assert.Single(await Get<Person[]>(web, "/api/admin/people")).IsActive);
        Assert.Contains(await Tasks(mobile, person.Id), t => t.Id == open.Id);
        Assert.Equal(open, await Get<AdminTask>(web, $"/api/admin/tasks/{open.Id}"));

        var inactive = await Read<Person>(await web.PostAsJsonAsync(path, new { confirm = true }, Ct), HttpStatusCode.OK);
        Assert.False(inactive.IsActive);
        Assert.Equal(0, inactive.OpenTaskCount);
        Assert.Equal(inactive, Assert.Single(await Get<Person[]>(web, "/api/admin/people")));
        Assert.DoesNotContain(await People(mobile), p => p.Id == person.Id);
        using var list = await mobile.GetAsync($"/api/mobile/tasks?personId={person.Id}", Ct);
        Assert.Equal(HttpStatusCode.NotFound, list.StatusCode);
        await AssertInaccessible(mobile, open.Id, person.Id);
        await AssertInaccessible(mobile, done.Id, person.Id);

        var refreshed = await WebTasks(web);
        Assert.Equal(open with { AssigneeId = null, AssigneeName = "Atanmamış" },
            Assert.Single(refreshed, t => t.Id == open.Id));
        Assert.Equal(completedOnWeb, Assert.Single(refreshed, t => t.Id == done.Id));
    }

    [Fact]
    public async Task Mobile_management_calls_are_rejected_without_changing_web_data()
    {
        using var factory = new AppFactory();
        using var web = factory.CreateClient();
        using var mobile = factory.CreateClient();
        var person = await CreatePerson(web, "Ada");
        var original = await Assign(web, (await CreateTask(web, "Protected work")).Id, person.Id);
        var path = MobilePath(original.Id, person.Id);
        var calls = new (HttpMethod Method, string Path, object Body)[]
        {
            (HttpMethod.Post, $"/api/mobile/tasks?personId={person.Id}", new { title = "Unauthorized" }),
            (HttpMethod.Put, path, new { title = "Changed" }),
            (HttpMethod.Delete, path, new { }),
            (HttpMethod.Put, MobilePath(original.Id, person.Id, "/assign"), new { assigneeId = (Guid?)null }),
            (HttpMethod.Post, "/api/mobile/people", new { fullName = "Unauthorized" }),
            (HttpMethod.Put, $"/api/mobile/people/{person.Id}", new { fullName = "Changed" }),
            (HttpMethod.Post, $"/api/mobile/people/{person.Id}/deactivate", new { confirm = true })
        };
        foreach (var call in calls)
        {
            using var request = new HttpRequestMessage(call.Method, call.Path) { Content = JsonContent.Create(call.Body) };
            using var response = await mobile.SendAsync(request, Ct);
            Assert.Contains(response.StatusCode, new[] { HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed });
        }
        Assert.Equal(original, Assert.Single(await WebTasks(web)));
        Assert.Equal(person with { OpenTaskCount = 1 }, Assert.Single(await Get<Person[]>(web, "/api/admin/people")));
        AssertTask(original, Assert.Single(await Tasks(mobile, person.Id)));
    }

    private static async Task<T> Read<T>(HttpResponseMessage response, HttpStatusCode expected)
    {
        using (response)
        {
            Assert.Equal(expected, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<T>(Ct))!;
        }
    }

    private static async Task<T> Get<T>(HttpClient client, string path) =>
        await Read<T>(await client.GetAsync(path, Ct), HttpStatusCode.OK);

    private static async Task<Person> CreatePerson(HttpClient web, string fullName) =>
        await Read<Person>(await web.PostAsJsonAsync("/api/admin/people", new { fullName }, Ct), HttpStatusCode.Created);

    private static async Task<AdminTask> CreateTask(HttpClient web, string title) =>
        await Read<AdminTask>(await web.PostAsJsonAsync("/api/admin/tasks",
            new { title, description = "Review details", dueDate = "2030-06-15" }, Ct), HttpStatusCode.Created);

    private static async Task<AdminTask> Assign(HttpClient web, Guid id, Guid? assigneeId) =>
        await Read<AdminTask>(await web.PutAsJsonAsync($"/api/admin/tasks/{id}/assign", new { assigneeId }, Ct), HttpStatusCode.OK);

    private static Task<AdminTask[]> WebTasks(HttpClient web) => Get<AdminTask[]>(web, "/api/admin/tasks");
    private static Task<MobilePerson[]> People(HttpClient mobile) => Get<MobilePerson[]>(mobile, "/api/mobile/people");
    private static Task<MobileTask[]> Tasks(HttpClient mobile, Guid personId) =>
        Get<MobileTask[]>(mobile, $"/api/mobile/tasks?personId={personId}");
    private static string MobilePath(Guid id, Guid personId, string action = "") =>
        $"/api/mobile/tasks/{id}{action}?personId={personId}";

    private static async Task AssertInaccessible(HttpClient mobile, Guid id, Guid personId)
    {
        using var detail = await mobile.GetAsync(MobilePath(id, personId), Ct);
        Assert.Equal(HttpStatusCode.NotFound, detail.StatusCode);
        foreach (var action in new[] { "/complete", "/reopen" })
        {
            using var response = await mobile.PostAsync(MobilePath(id, personId, action), null, Ct);
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }
    }

    private static void AssertTask(AdminTask expected, MobileTask actual) =>
        Assert.Equal(new MobileTask(expected.Id, expected.Title, expected.Description, expected.DueDate,
            expected.AssigneeId, expected.Status, expected.CreatedAt, expected.CompletedAt), actual);
}
