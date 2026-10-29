using Microsoft.EntityFrameworkCore;

namespace GorevPanosu.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Person> People => Set<Person>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        PreservePeople();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        PreservePeople();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void PreservePeople()
    {
        if (ChangeTracker.Entries<Person>().Any(entry => entry.State == EntityState.Deleted))
            throw new InvalidOperationException("People must be deactivated instead of deleted.");
    }

    // Entity mappings live next to their feature as IEntityTypeConfiguration<T> classes and are discovered here,
    // so adding a feature never edits this file.
    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
}
