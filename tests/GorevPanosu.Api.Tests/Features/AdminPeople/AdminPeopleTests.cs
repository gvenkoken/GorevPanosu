using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GorevPanosu.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PersonResponse = GorevPanosu.Api.Features.AdminPeople.AdminPeopleEndpoints.PersonResponse;

namespace GorevPanosu.Api.Tests.Features.AdminPeople;

public sealed class AdminPeopleTests
{
    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;
    private const string Url = "/api/admin/people";

    [Fact]
    public async Task Create_rename_and_list_include_active_and_inactive_people()
    {
        using var factory = new AppFactory();
        using var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync(Url, new { fullName = "  Ada  " }, CancellationToken);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var person = (await created.Content.ReadFromJsonAsync<PersonResponse>(CancellationToken))!;
        Assert.Equal("Ada", person.FullName);
        Assert.True(person.IsActive);
        Assert.Equal($"{Url}/{person.Id}", created.Headers.Location?.OriginalString);
        var renamed = await client.PutAsJsonAsync($"{Url}/{person.Id}", new { fullName = "Ada Lovelace" }, CancellationToken);
        Assert.Equal(HttpStatusCode.OK, renamed.StatusCode);
        Assert.Equal("Ada Lovelace", (await renamed.Content.ReadFromJsonAsync<PersonResponse>(CancellationToken))!.FullName);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync($"{Url}/{person.Id}/deactivate", new { confirm = false }, CancellationToken)).StatusCode);
        var active = new Person { FullName = "Grace" };
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.People.Add(active);
            db.Tasks.Add(new TaskItem { Title = "Open", AssigneeId = active.Id });
            await db.SaveChangesAsync(CancellationToken);
        }
        var people = (await client.GetFromJsonAsync<PersonResponse[]>(Url, CancellationToken))!;
        Assert.Equal(2, people.Length);
        Assert.Contains(people, p => p.Id == person.Id && !p.IsActive && p.FullName == "Ada Lovelace" && p.OpenTaskCount == 0);
        Assert.Contains(people, p => p.Id == active.Id && p.IsActive && p.OpenTaskCount == 1);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \t ")]
    public async Task Blank_names_are_rejected_for_create_and_rename(string? name)
    {
        using var factory = new AppFactory();
        using var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync(Url, new { fullName = "Original" }, CancellationToken);
        var person = (await created.Content.ReadFromJsonAsync<PersonResponse>(CancellationToken))!;
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(Url, new { fullName = name }, CancellationToken)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Url}/{person.Id}", new { fullName = name }, CancellationToken)).StatusCode);
        var people = (await client.GetFromJsonAsync<PersonResponse[]>(Url, CancellationToken))!;
        Assert.Equal("Original", Assert.Single(people).FullName);
    }

    [Fact]
    public async Task Deactivation_requires_confirmation_and_preserves_completed_assignment()
    {
        using var factory = new AppFactory();
        using var client = factory.CreateClient();
        var person = new Person { FullName = "Ada" };
        var completed = new TaskItem { Title = "Completed", AssigneeId = person.Id };
        completed.Complete();
        var other = new Person { FullName = "Grace" };
        var unrelated = new TaskItem { Title = "Other", AssigneeId = other.Id };
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.People.AddRange(person, other);
            db.Tasks.AddRange(completed, unrelated,
                new TaskItem { Title = "One", AssigneeId = person.Id },
                new TaskItem { Title = "Two", AssigneeId = person.Id });
            await db.SaveChangesAsync(CancellationToken);
        }
        var warning = await client.PostAsJsonAsync($"{Url}/{person.Id}/deactivate", new { confirm = false }, CancellationToken);
        Assert.Equal(HttpStatusCode.Conflict, warning.StatusCode);
        var problem = await warning.Content.ReadFromJsonAsync<JsonElement>(CancellationToken);
        Assert.Equal(2, problem.GetProperty("openTaskCount").GetInt32());
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.True((await db.People.FindAsync([person.Id], CancellationToken))!.IsActive);
            Assert.Equal(3, await db.Tasks.CountAsync(t => t.AssigneeId == person.Id, CancellationToken));
        }
        var response = await client.PostAsJsonAsync($"{Url}/{person.Id}/deactivate", new { confirm = true }, CancellationToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False((await response.Content.ReadFromJsonAsync<PersonResponse>(CancellationToken))!.IsActive);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.False((await db.People.FindAsync([person.Id], CancellationToken))!.IsActive);
            var tasks = await db.Tasks.Include(t => t.Assignee).ToListAsync(CancellationToken);
            Assert.All(tasks.Where(t => t.Title is "One" or "Two"), t => Assert.Null(t.AssigneeId));
            var retained = Assert.Single(tasks, t => t.Id == completed.Id);
            Assert.Equal(person.Id, retained.AssigneeId);
            Assert.Equal("Ada", retained.Assignee!.FullName);
            Assert.Equal(other.Id, Assert.Single(tasks, t => t.Id == unrelated.Id).AssigneeId);
        }
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync($"{Url}/{person.Id}/deactivate", new { confirm = false }, CancellationToken)).StatusCode);
    }

    [Fact]
    public async Task Delete_is_unavailable_and_unknown_people_return_not_found()
    {
        using var factory = new AppFactory();
        using var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync(Url, new { fullName = "Retained" }, CancellationToken);
        var person = (await created.Content.ReadFromJsonAsync<PersonResponse>(CancellationToken))!;
        var deleted = await client.DeleteAsync($"{Url}/{person.Id}", CancellationToken);
        Assert.True(deleted.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.MethodNotAllowed);
        using var scope = factory.Services.CreateScope();
        Assert.NotNull(await scope.ServiceProvider.GetRequiredService<AppDbContext>().People.FindAsync([person.Id], CancellationToken));
        var missing = Guid.NewGuid();
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync($"{Url}/{missing}", new { fullName = "Name" }, CancellationToken)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync($"{Url}/{missing}/deactivate", new { confirm = true }, CancellationToken)).StatusCode);
    }
}
