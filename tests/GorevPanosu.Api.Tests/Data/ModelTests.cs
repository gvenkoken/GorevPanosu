using GorevPanosu.Api.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Status = GorevPanosu.Api.Data.TaskStatus;

namespace GorevPanosu.Api.Tests.Data;

public sealed class ModelTests
{
    [Fact]
    public async Task Migration_creates_schema_and_utc_timestamps_round_trip()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options;
        await using var db = new AppDbContext(options);
        await db.Database.MigrateAsync(TestContext.Current.CancellationToken);
        Assert.Single(await db.Database.GetAppliedMigrationsAsync(TestContext.Current.CancellationToken));
        var personType = db.Model.FindEntityType(typeof(Person))!;
        var taskType = db.Model.FindEntityType(typeof(TaskItem))!;
        Assert.Equal("People", personType.GetTableName());
        Assert.Equal("Tasks", taskType.GetTableName());
        Assert.Equal(new[] { "FullName", "Id", "IsActive" }, personType.GetProperties().Select(p => p.Name).OrderBy(n => n));
        Assert.Equal(new[] { "AssigneeId", "CompletedAt", "CreatedAt", "Description", "DueDate", "Id", "Status", "Title" },
            taskType.GetProperties().Select(p => p.Name).OrderBy(n => n));
        Assert.Equal(120, taskType.FindProperty(nameof(TaskItem.Title))!.GetMaxLength());
        Assert.False(taskType.FindProperty(nameof(TaskItem.Title))!.IsNullable);
        var foreignKey = Assert.Single(taskType.GetForeignKeys());
        Assert.Equal(personType, foreignKey.PrincipalEntityType);
        Assert.Equal(nameof(TaskItem.AssigneeId), Assert.Single(foreignKey.Properties).Name);
        Assert.True(foreignKey.Properties[0].IsNullable);
        var person = new Person { FullName = "Ada" };
        var task = new TaskItem { Title = "Review", Assignee = person };
        task.Complete();
        var createdAt = task.CreatedAt;
        var completedAt = task.CompletedAt;
        db.Add(task);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        db.ChangeTracker.Clear();
        var saved = await db.Tasks.Include(t => t.Assignee).SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(person.Id, saved.AssigneeId);
        Assert.Equal("Ada", saved.Assignee!.FullName);
        Assert.Equal(createdAt, saved.CreatedAt);
        Assert.Equal(completedAt, saved.CompletedAt);
        Assert.Equal(DateTimeKind.Utc, saved.CreatedAt.Kind);
        Assert.Equal(DateTimeKind.Utc, saved.CompletedAt!.Value.Kind);
        Assert.Equal(Status.Completed, saved.Status);

        db.Tasks.Add(new TaskItem { Title = "Unassigned" });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        db.Tasks.Add(new TaskItem { Title = "Invalid assignee", AssigneeId = Guid.NewGuid() });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task People_cannot_be_physically_deleted()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.MigrateAsync(TestContext.Current.CancellationToken);
        var person = new Person { FullName = "Ada" };
        db.People.Add(person);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        person.IsActive = false;
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        db.People.Remove(person);
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public void Completion_and_reopening_manage_status_and_timestamps()
    {
        var task = new TaskItem { Title = "Review" };
        var createdAt = task.CreatedAt;
        Assert.Equal(Status.Open, task.Status);
        Assert.Null(task.CompletedAt);
        task.Complete();
        var completedAt = task.CompletedAt;
        task.Complete();
        Assert.Equal(completedAt, task.CompletedAt);
        task.Reopen();
        Assert.Equal(Status.Open, task.Status);
        Assert.Null(task.CompletedAt);
        Assert.Equal(createdAt, task.CreatedAt);
    }

    [Fact]
    public void PostgreSql_migration_uses_expected_column_types_and_constraints()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=unused").Options);
        var script = db.GetService<IMigrator>().GenerateScript();
        Assert.Contains("character varying(120)", script);
        Assert.Contains("timestamp with time zone", script);
        Assert.Contains("FOREIGN KEY", script);
        Assert.Contains("ON DELETE RESTRICT", script);
    }
}
